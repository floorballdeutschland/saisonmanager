import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { EmailTemplateService, NotificationService } from '@floorball/core';
import { EmailTemplate } from '@floorball/types';

interface TemplateEdit {
  subject: string;
  from_address: string;
  reply_to_address: string;
}

interface MailerGroup {
  mailerClass: string;
  templates: EmailTemplate[];
}

@Component({
  templateUrl: './email-template-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EmailTemplateIndexComponent implements OnInit, OnDestroy {
  templates: EmailTemplate[] = [];
  groups: MailerGroup[] = [];
  edits: Record<string, TemplateEdit> = {};
  loading = false;
  loadError = false;
  savingKeys = new Set<string>();

  private _destroy$ = new Subject<void>();

  constructor(
    private _emailTemplateService: EmailTemplateService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.loadError = false;
    this._emailTemplateService
      .getAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.templates = result;
          this._rebuild();
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.loadError = true;
          this._notificationService.error(
            this._transloco.translate(
              'emailTemplateAdmin.notifications.loadError'
            ),
            { autoClose: false }
          );
          this._cdr.markForCheck();
        },
      });
  }

  isSaving(template: EmailTemplate): boolean {
    return this.savingKeys.has(template.key);
  }

  save(template: EmailTemplate): void {
    if (this.savingKeys.has(template.key)) return;
    const edit = this.edits[template.key];
    if (!edit) return;
    this.savingKeys.add(template.key);
    this._emailTemplateService
      .update({
        mailer_class: template.mailer_class,
        action_name: template.action_name,
        subject: edit.subject.trim(),
        from_address: edit.from_address.trim(),
        reply_to_address: edit.reply_to_address.trim(),
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.savingKeys.delete(template.key);
          this._replace(updated);
          this._notificationService.success(
            this._transloco.translate(
              'emailTemplateAdmin.notifications.saved',
              { name: updated.description }
            ),
            { autoClose: true }
          );
          this._cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          this.savingKeys.delete(template.key);
          const detail = err.error?.errors?.join(', ') ?? err.message;
          this._notificationService.error(
            this._transloco.translate(
              'emailTemplateAdmin.notifications.saveError',
              { detail }
            ),
            { autoClose: false }
          );
          this._cdr.markForCheck();
        },
      });
  }

  reset(template: EmailTemplate): void {
    if (this.savingKeys.has(template.key)) return;
    if (
      !confirm(
        this._transloco.translate('emailTemplateAdmin.confirmReset', {
          name: template.description,
        })
      )
    )
      return;
    this.savingKeys.add(template.key);
    this._emailTemplateService
      .update({
        mailer_class: template.mailer_class,
        action_name: template.action_name,
        subject: '',
        from_address: '',
        reply_to_address: '',
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.savingKeys.delete(template.key);
          this._replace(updated);
          this._notificationService.success(
            this._transloco.translate(
              'emailTemplateAdmin.notifications.reset',
              { name: updated.description }
            ),
            { autoClose: true }
          );
          this._cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          this.savingKeys.delete(template.key);
          const detail = err.error?.errors?.join(', ') ?? err.message;
          this._notificationService.error(
            this._transloco.translate(
              'emailTemplateAdmin.notifications.saveError',
              { detail }
            ),
            { autoClose: false }
          );
          this._cdr.markForCheck();
        },
      });
  }

  private _replace(updated: EmailTemplate): void {
    const index = this.templates.findIndex((t) => t.key === updated.key);
    if (index === -1) return;
    this.templates[index] = updated;
    this._rebuild();
  }

  private _rebuild(): void {
    this.edits = {};
    for (const template of this.templates) {
      this.edits[template.key] = {
        subject: template.subject ?? template.default_subject ?? '',
        from_address: template.from_address ?? template.default_from ?? '',
        reply_to_address:
          template.reply_to_address ?? template.default_reply_to ?? '',
      };
    }

    const byMailer = new Map<string, EmailTemplate[]>();
    for (const template of this.templates) {
      const list = byMailer.get(template.mailer_class) ?? [];
      list.push(template);
      byMailer.set(template.mailer_class, list);
    }
    this.groups = Array.from(byMailer.entries())
      .map(([mailerClass, templates]) => ({ mailerClass, templates }))
      .sort((a, b) => a.mailerClass.localeCompare(b.mailerClass));
  }
}
