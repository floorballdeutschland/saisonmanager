import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { LeagueService, NotificationService } from '@floorball/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';

@Component({
  templateUrl: './import-game-days.component.html',
  encapsulation: ViewEncapsulation.None,
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
    private _metaTitle: Title
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
        this._notificationService.success('Import erfolgreich', {
          autoClose: true,
          keepAfterRouteChange: true,
        });
        this._router.navigate(['verwaltung', 'ligen']);
        this.fileInput.nativeElement.value = '';
      },
      error: (errRes) => {
        console.log(errRes);
        const msg = JSON.parse(errRes);

        this.errors = msg.errors;
        this.warnings = msg.warnings;

        this.fileInput.nativeElement.value = '';
        this._cdr.markForCheck();
      },
    });
  }
}
