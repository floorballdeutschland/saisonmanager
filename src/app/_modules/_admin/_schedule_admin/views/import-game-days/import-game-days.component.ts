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

  // True, sobald eine Datei ausgewählt ist. Steuert, ob der Import überhaupt
  // angeboten wird.
  public get hasFile(): boolean {
    return this.form?.get('importfile')?.value instanceof File;
  }

  public onFileChange(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    // Auch der Abbruch im Dateidialog kommt hier an, dann ist die Liste leer.
    // Ohne den zweiten Zweig bliebe die vorige Auswahl stehen, obwohl das Feld
    // sichtbar leer ist.
    const file = files && files.length > 0 ? files[0] : null;
    this.form?.get('importfile')?.setValue(file);

    // Meldungen des vorigen Versuchs gehören nicht zur neuen Datei.
    this.errors = [];
    this.warnings = [];
    this._cdr.markForCheck();
  }

  public import() {
    const file = this.form?.get('importfile')?.value;

    // Ohne diese Prüfung ging der Anfangswert des Formularfelds als leerer
    // String an die API. Die antwortete darauf bis api#568 mit 401
    // „Nicht eingeloggt.", und ein 401 meldet im ErrorInterceptor ab: Wer den
    // Knopf ohne Auswahl drückte, landete auf der Anmeldeseite statt bei einem
    // Hinweis. Auf Produktion trugen in den 30 Tagen vor diesem Fix 11 von 12
    // Importversuchen einen leeren Dateiparameter.
    //
    // Die API weist den leeren Wert seit api#568 sauber ab; hier wird er gar
    // nicht erst gesendet, damit der Hinweis ohne Umweg über den Server an der
    // Stelle steht, an der geklickt wurde.
    if (!(file instanceof File)) {
      this.errors = [
        this._transloco.translate(
          'scheduleAdmin.importGameDays.noFileSelected'
        ),
      ];
      this.warnings = [];
      this._cdr.markForCheck();
      return;
    }

    this.running = true;

    const formData = new FormData();
    formData.append('file', file);

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
        this.running = false;

        const msg = this._parseImportResult(errRes?.error?.message);
        this.errors = msg.errors;
        this.warnings = msg.warnings;

        // Auswahl auch im Formular zurücknehmen, nicht nur im sichtbaren Feld.
        // Sonst zeigt die Maske ein leeres Dateifeld, während intern noch die
        // alte Datei hängt, und der nächste Klick schickt sie unbemerkt erneut.
        this.fileInput.nativeElement.value = '';
        this.form?.get('importfile')?.setValue(null);
        this._cdr.markForCheck();
      },
    });
  }

  // Die Importfehler kommen als JSON-String im Feld `message`
  // (LeaguesController#admin_schedule_import_games). Andere Fehlerquellen
  // derselben Anfrage tun das nicht: ein 502 des Reverse Proxy, eine
  // Wartungsseite, ein Netzwerkabbruch. `JSON.parse` warf darauf bisher
  // mitten im error-Zweig, wodurch die Maske gar keine Meldung zeigte und
  // stumm im Zustand „läuft" stehen blieb. Deshalb hier abgesichert und im
  // Zweifel ein allgemeiner Hinweis.
  private _parseImportResult(message: unknown): {
    errors: string[];
    warnings: string[];
  } {
    if (typeof message === 'string') {
      try {
        const parsed = JSON.parse(message);
        if (parsed && typeof parsed === 'object') {
          return {
            errors: Array.isArray(parsed.errors) ? parsed.errors : [],
            warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
          };
        }
      } catch {
        // Kein JSON, unten weiter mit dem allgemeinen Hinweis.
      }
    }

    return {
      errors: [
        this._transloco.translate('scheduleAdmin.importGameDays.importFailed'),
      ],
      warnings: [],
    };
  }
}
