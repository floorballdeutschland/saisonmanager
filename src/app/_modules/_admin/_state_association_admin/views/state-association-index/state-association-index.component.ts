import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { StateAssociationService, NotificationService } from '@floorball/core';
import { StateAssociation } from '@floorball/types';

@Component({
  templateUrl: './state-association-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StateAssociationIndexComponent implements OnInit, OnDestroy {
  stateAssociations: StateAssociation[] = [];
  loading = false;

  get sortedRows(): Array<{ sa: StateAssociation; isChild: boolean }> {
    const roots = this.stateAssociations.filter((sa) => !sa.parent_id);
    const rows: Array<{ sa: StateAssociation; isChild: boolean }> = [];
    for (const root of roots) {
      rows.push({ sa: root, isChild: false });
      const children = this.stateAssociations.filter(
        (sa) => sa.parent_id === root.id
      );
      for (const child of children) {
        rows.push({ sa: child, isChild: true });
      }
    }
    // Append orphans (shouldn't exist, but safety net)
    const listed = new Set(rows.map((r) => r.sa.id));
    for (const sa of this.stateAssociations) {
      if (!listed.has(sa.id)) rows.push({ sa, isChild: false });
    }
    return rows;
  }

  private _destroy$ = new Subject<void>();

  constructor(
    private _stateAssociationService: StateAssociationService,
    private _notificationService: NotificationService,
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
    this._stateAssociationService
      .adminGetAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.stateAssociations = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  delete(sa: StateAssociation): void {
    if (!confirm(`Landesverband "${sa.name}" wirklich löschen?`)) return;

    this._stateAssociationService
      .adminDelete(sa.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this._notificationService.success(`"${sa.name}" gelöscht.`, {
            autoClose: true,
          });
          this.load();
        },
        error: () => {
          this._notificationService.error('Fehler beim Löschen.', {
            autoClose: false,
          });
        },
      });
  }
}
