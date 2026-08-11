import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  SponsorLogo,
  SponsorLogoScope,
  SponsorLogoService,
} from '@floorball/core';

/**
 * Pflege der Partnerlogos für die Livestream-Overlays.
 *
 * Eine Komponente für beide Ebenen: Der Verband pflegt die Partner einer Liga
 * (`scope="leagues"`), der Verein die seines Vereins (`scope="clubs"`).
 * Serverseitig verhalten sich beide gleich, deshalb gibt es hier auch nur eine
 * Oberfläche statt zweier, die auseinanderlaufen.
 *
 * Die Übersetzungen liegen im globalen Sprachpaket und nicht in einem eigenen
 * Scope: Die Komponente wird aus zwei Feature-Modulen heraus benutzt, und ein
 * Scope löste nur in dem Modul auf, das ihn zufällig bereitstellt.
 *
 * Das gilt auch für die Fehlermeldungen. Sie standen zunächst als deutsche
 * Zeichenketten im Code, während das Sprachpaket nur die Beschriftungen kannte —
 * ein englischsprachiger Nutzer bekam die Oberfläche auf Englisch und die
 * Fehlermeldung darunter auf Deutsch.
 */
@Component({
  selector: 'fb-sponsor-logos',
  templateUrl: './sponsor-logos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SponsorLogosComponent implements OnInit {
  @Input({ required: true }) scope!: SponsorLogoScope;
  @Input({ required: true }) ownerId!: number;

  public logos: SponsorLogo[] = [];
  public busy = false;
  public error = '';

  // Dieselbe Grenze wie serverseitig. Sie steht hier ein zweites Mal, damit der
  // Knopf verschwindet, statt erst nach dem Hochladen eine Absage zu bekommen —
  // maßgeblich bleibt die Prüfung im Backend.
  public readonly maxLogos = 8;
  private readonly _maxSize = 1024 * 1024;

  constructor(
    private _sponsorLogoService: SponsorLogoService,
    private _cdr: ChangeDetectorRef,
    private _transloco: TranslocoService
  ) {}

  ngOnInit(): void {
    if (!this.ownerId) return;

    this._sponsorLogoService.list(this.scope, this.ownerId).subscribe({
      next: (res) => {
        this.logos = res.sponsor_logos;
        this._cdr.markForCheck();
      },
      // Kein Hinweis: Der Abruf klärt nur, was schon da ist. Schlägt er fehl,
      // bleibt die leere Liste und der Knopf zum Hochladen stehen.
      error: () => {
        this.logos = [];
        this._cdr.markForCheck();
      },
    });
  }

  public get limitReached(): boolean {
    return this.logos.length >= this.maxLogos;
  }

  public onFileSelected(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file || this.busy) return;

    // Vor dem Hochladen abfangen, was der Server ohnehin abweisen würde: Eine
    // Absage nach dem Übertragen einer zu großen Datei dauert unnötig lange.
    if (file.size > this._maxSize) {
      this.error = this._transloco.translate('sponsorLogos.errTooLarge');
      input.value = '';
      return;
    }

    this.busy = true;
    this.error = '';
    this._sponsorLogoService.upload(this.scope, this.ownerId, file).subscribe({
      next: (res) => {
        this.logos = res.sponsor_logos;
        this.busy = false;
        // Zurücksetzen, sonst löst dieselbe Datei kein change-Ereignis mehr aus
        // und ein zweiter Versuch nach einem Fehler bliebe wirkungslos.
        input.value = '';
        this._cdr.markForCheck();
      },
      error: (err) => {
        this.error =
          err?.error?.message ??
          this._transloco.translate('sponsorLogos.errUpload');
        this.busy = false;
        input.value = '';
        this._cdr.markForCheck();
      },
    });
  }

  public onRemove(logo: SponsorLogo): void {
    if (this.busy) return;

    this.busy = true;
    this.error = '';
    this._sponsorLogoService
      .remove(this.scope, this.ownerId, logo.id)
      .subscribe({
        next: (res) => {
          this.logos = res.sponsor_logos;
          this.busy = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.error = this._transloco.translate('sponsorLogos.errRemove');
          this.busy = false;
          this._cdr.markForCheck();
        },
      });
  }
}
