import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import { LeagueService, NotificationService } from '@floorball/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';

@Component({
  templateUrl: './import-game-days.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ImportGameDaysComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef;

  form!: UntypedFormGroup;
  running = false;

  errors: string[] = [];
  warnings: string[] = [];

  constructor(
    private _leagueService: LeagueService,
    private _router: Router,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef,
    private formBuilder: UntypedFormBuilder,
    private _metaTitle: Title,
    private _transloco: TranslocoService
  ) {
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      importfile: [''],
    });
  }

  public onFileChange(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (files) {
      const file = files[0];
      this.form?.get('importfile')?.setValue(file);
    }
  }

  public import() {
    this.running = true;

    const formData = new FormData();
    formData.append('file', this.form?.get('importfile')?.value);

    this._leagueService.adminImportGameSchedule(formData).subscribe({
      next: () => {
        // notification: alles super
        // redirect liga index
        this._notificationService.success(
          this._transloco.translate(
            'scheduleAdmin.notifications.importSuccess'
          ),
          {
            autoClose: true,
            keepAfterRouteChange: true,
          }
        );
        this._router.navigate(['verwaltung', 'ligen']);
        this.fileInput.nativeElement.value = '';
      },
      error: (errRes) => {
        // Backend liefert errors/warnings als JSON-String in error.message
        // (siehe LeaguesController#admin_schedule_import_games); errRes ist
        // seit dem ErrorInterceptor-Umbau die HttpErrorResponse, kein String mehr.
        const msg = JSON.parse(errRes?.error?.message ?? '{}');

        this.errors = msg.errors;
        this.warnings = msg.warnings;

        this.fileInput.nativeElement.value = '';
        this._cdr.markForCheck();
      },
    });
  }
}
