import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { GameService } from '@floorball/core';
import { ProtestUpload } from '@floorball/types';

/** Größte Datei, die die API annimmt (GameProtest::MAX_FILE_SIZE). */
export const PROTEST_MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Upload des Protestformulars einer Protestpartei. Erreichbar nur über den
 * Link aus der Mail; der Token ist die einzige Berechtigung. Pro Link genau
 * ein Formular, danach ist er verbraucht. Ungültig wird er auch, wenn die SBK
 * einen neuen verschickt oder die Partei abgewählt wird.
 *
 * Fehler zeigt die Seite selbst an, der ErrorInterceptor lässt den Endpunkt
 * aus (sonst käme jede Meldung doppelt).
 */
@Component({
  templateUrl: './protest-upload.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ProtestUploadComponent implements OnInit, OnDestroy {
  loading = true;
  invalid = false;
  /** Begründung der API zum ungültigen Link (z. B. zurückgenommen). */
  invalidMessage: string | null = null;
  /** Laden vorübergehend gescheitert, ein neuer Versuch lohnt sich. */
  loadFailed = false;
  uploading = false;
  protest?: ProtestUpload;
  selectedFile: File | null = null;
  errorMessage: string | null = null;

  private _token = '';
  private _destroy$ = new Subject<void>();

  constructor(
    private _route: ActivatedRoute,
    private _gameService: GameService,
    private _meta: Meta,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Persönlicher Link: gehört nicht in Suchmaschinen.
    this._meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this._token = this._route.snapshot.paramMap.get('token') ?? '';
    this._load();
  }

  ngOnDestroy(): void {
    this._meta.removeTag("name='robots'");
    this._destroy$.next();
    this._destroy$.complete();
  }

  // Vorab im Browser geprüft, damit niemand eine große Datei erst hochlädt, um
  // dann abgewiesen zu werden. Verbindlich bleibt die Prüfung der API.
  selectFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.errorMessage = null;
    this.selectedFile = null;
    if (!file) return;

    const isPdf =
      file.type === 'application/pdf' || /\.pdf$/i.test(file.name ?? '');
    if (!isPdf) {
      this.errorMessage =
        'Bitte lade das Protestformular als PDF hoch. Fotos werden nicht angenommen.';
    } else if (file.size > PROTEST_MAX_FILE_SIZE) {
      this.errorMessage = 'Die Datei ist größer als 5 MB.';
    } else {
      this.selectedFile = file;
    }
    this._cdr.markForCheck();
  }

  upload(): void {
    if (!this.selectedFile || this.uploading) return;

    this.uploading = true;
    this.errorMessage = null;
    this._gameService
      .uploadProtest(this._token, this.selectedFile)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (protest) => {
          this.protest = protest;
          this.uploading = false;
          this.selectedFile = null;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.uploading = false;
          this.errorMessage =
            err?.status === 0
              ? 'Keine Verbindung. Bitte prüfe die Internetverbindung und versuche es erneut.'
              : (err?.error?.message ??
                'Das Protestformular konnte nicht hochgeladen werden. Bitte versuche es erneut.');
          if (err?.status === 410) {
            this.invalid = true;
            this.invalidMessage = err?.error?.message ?? null;
          }
          this._cdr.markForCheck();
        },
      });
  }

  formatDate(date?: string | null): string {
    if (!date) return '';

    return new Date(date + 'T00:00:00').toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  formatDateTime(value?: string | null): string {
    if (!value) return '';

    return new Date(value).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  retryLoad(): void {
    this.loadFailed = false;
    this.loading = true;
    this._cdr.markForCheck();
    this._load();
  }

  private _load(): void {
    if (!this._token) {
      this.loading = false;
      this.invalid = true;
      return;
    }

    this._gameService
      .getProtest(this._token)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (protest) => {
          this.protest = protest;
          this.loading = false;
          this._cdr.markForCheck();
        },
        // Nur 410 heißt „ungültig" (unbekannt, ersetzt oder zurückgenommen).
        // Funkloch, Drosselung oder Serverfehler sind vorübergehend: Dann
        // soll die Partei es erneut versuchen, statt aufzugeben.
        error: (err) => {
          this.loading = false;
          if (err?.status === 410) {
            this.invalid = true;
            this.invalidMessage = err?.error?.message ?? null;
          } else {
            this.loadFailed = true;
          }
          this._cdr.markForCheck();
        },
      });
  }
}
