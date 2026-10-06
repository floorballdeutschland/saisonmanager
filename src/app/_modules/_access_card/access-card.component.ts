import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
} from '@angular/core';
import QRCode from 'qrcode';

/** Eine Adresse auf dem Zettel: Überschrift, Adresse und kurzer Hinweis. */
export interface AccessCardEntry {
  label: string;
  url: string;
  hint?: string;
}

interface RenderedEntry extends AccessCardEntry {
  qrDataUrl: string | null;
}

// Die Zugänge gelten im Kalender des Spielbetriebs (GameDayLinkWindow in der
// API). Ohne feste Zeitzone druckte ein Rechner mit anderer Einstellung eine
// Uhrzeit, die am Spieltisch nicht stimmt.
const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin',
};

const PRINT_CSS = `
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; }
  h1 { font-size: 22pt; margin: 0 0 4mm; }
  .subject { font-size: 13pt; margin: 0 0 2mm; }
  .validity { font-size: 12pt; font-weight: bold; margin: 0 0 8mm; }
  .entries { display: flex; flex-wrap: wrap; gap: 10mm; }
  .entry { flex: 1 1 70mm; break-inside: avoid; }
  .entry h2 { font-size: 14pt; margin: 0 0 2mm; }
  .entry img { width: 60mm; height: 60mm; display: block; }
  .entry .url { font-family: monospace; font-size: 8pt; word-break: break-all; margin: 2mm 0 0; }
  .entry .hint { font-size: 10pt; margin: 2mm 0 0; }
  .code { margin: 8mm 0 0; font-size: 11pt; }
  .code strong { display: block; font-family: monospace; font-size: 28pt; letter-spacing: 0.15em; }
  .notice { margin: 10mm 0 0; font-size: 9pt; border-top: 1px solid #000; padding-top: 3mm; }
`;

/**
 * Zugang zum Ausdrucken und Weitergeben (Feedback #70): je Adresse ein
 * QR-Code, dazu wofür der Zugang ist, für welchen Spieltag und von wann bis
 * wann er gilt.
 *
 * Nur direkt nach dem Erzeugen zu sehen. Das Token liegt serverseitig bloß als
 * Digest, der QR-Code lässt sich später also nicht nachreichen. Wer den Zettel
 * verliert, erzeugt einen neuen Zugang und entwertet damit den alten.
 *
 * Gedruckt wird aus einem eigenen Fenster statt aus der Seite. Die Seite trägt
 * Navigation, Seitenleiste und je Spieltag weitere Abschnitte; sie per
 * Druck-CSS auf eine einzige Karte einzudampfen, ließe leere Folgeseiten
 * stehen und bräche bei der nächsten Layoutänderung still.
 */
@Component({
  selector: 'fb-access-card',
  templateUrl: './access-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AccessCardComponent implements OnChanges {
  /** Wofür der Zugang ist, etwa „Spielsekretariat". */
  @Input({ required: true }) title = '';
  /** Spieltag: Datum, Halle, Ligen. */
  @Input() subject = '';
  @Input() validFrom: string | null | undefined = null;
  @Input() expiresAt: string | null | undefined = null;
  @Input() entries: AccessCardEntry[] | null | undefined = [];
  /** Kurzcode zum Abtippen, falls der QR-Code nicht gelesen werden kann. */
  @Input() code: string | null = null;
  /** Hinweis am Fuß des Ausdrucks, etwa zum Umgang mit dem Zettel. */
  @Input() notice = '';

  rendered: RenderedEntry[] = [];
  printError = '';

  // Gegen überholte Antworten: QRCode.toDataURL ist asynchron, und kommen die
  // Eingaben zweimal kurz hintereinander, darf das Ergebnis des ersten Laufs
  // nicht das des zweiten überschreiben.
  private _generation = 0;

  constructor(private _cdr: ChangeDetectorRef) {}

  ngOnChanges(): void {
    this._renderQrCodes();
  }

  get validity(): string {
    const until = this._format(this.expiresAt);
    if (!until) return '';

    const from = this._format(this.validFrom);
    return from
      ? `Gültig von ${from} Uhr bis ${until} Uhr`
      : `Gültig bis ${until} Uhr`;
  }

  /** Der Code in zwei Vierergruppen, wie auf der Sekretariatsseite. */
  get formattedCode(): string {
    if (!this.code) return '';
    return this.code.length === 8
      ? `${this.code.slice(0, 4)}-${this.code.slice(4)}`
      : this.code;
  }

  print(): void {
    this.printError = '';

    const win =
      typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (!win) {
      this.printError =
        'Das Druckfenster wurde vom Browser blockiert. Bitte Pop-ups für diese Seite erlauben und erneut versuchen.';
      this._cdr.markForCheck();
      return;
    }

    const doc = win.document;
    this._buildPrintDocument(doc);

    // Die Bilder sind Data-URLs, liegen also vor. Dekodiert sind sie damit noch
    // nicht, und ein zu früher Druckdialog zeigt leere Kästen.
    const images = Array.from(doc.images);
    Promise.all(images.map((img) => img.decode().catch(() => undefined))).then(
      () => {
        win.focus();
        win.print();
      }
    );
  }

  private _buildPrintDocument(doc: Document): void {
    // Aufgebaut über das DOM statt über einen HTML-String: Liga- und
    // Hallennamen kommen aus der Datenbank, und textContent setzt sie als Text,
    // nicht als Markup.
    doc.title = [this.title, this.subject].filter(Boolean).join(' · ');

    const style = doc.createElement('style');
    style.textContent = PRINT_CSS;
    doc.head.appendChild(style);

    const body = doc.body;
    body.replaceChildren();

    const add = (parent: HTMLElement, tag: string, cls: string, text = '') => {
      const el = doc.createElement(tag);
      if (cls) el.className = cls;
      if (text) el.textContent = text;
      parent.appendChild(el);
      return el;
    };

    add(body, 'h1', '', this.title);
    if (this.subject) add(body, 'p', 'subject', this.subject);
    if (this.validity) add(body, 'p', 'validity', this.validity);

    const list = add(body, 'div', 'entries');
    for (const entry of this.rendered) {
      const box = add(list, 'div', 'entry');
      add(box, 'h2', '', entry.label);
      if (entry.qrDataUrl) {
        const img = add(box, 'img', '') as HTMLImageElement;
        img.src = entry.qrDataUrl;
        img.alt = `QR-Code: ${entry.label}`;
      }
      if (entry.hint) add(box, 'p', 'hint', entry.hint);
      add(box, 'p', 'url', entry.url);
    }

    if (this.code) {
      const code = add(
        body,
        'p',
        'code',
        'Ohne Kamera: Adresse aufrufen und diesen Code eingeben'
      );
      add(code, 'strong', '', this.formattedCode);
    }

    if (this.notice) add(body, 'p', 'notice', this.notice);
  }

  private _renderQrCodes(): void {
    const generation = ++this._generation;
    const entries = this.entries ?? [];
    this.rendered = entries.map((e) => ({ ...e, qrDataUrl: null }));

    Promise.all(
      entries.map((entry) =>
        QRCode.toDataURL(entry.url, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 480,
        }).catch((err: unknown) => {
          // Ohne QR-Code bleibt der Zettel brauchbar: Adresse und Code stehen
          // im Klartext daneben. Laut melden, damit ein Bündelungsfehler der
          // Bibliothek nicht still für alle verschwindet.
          console.error('QR-Code konnte nicht erzeugt werden', err);
          return null;
        })
      )
    ).then((urls) => {
      if (generation !== this._generation) return;

      this.rendered = entries.map((e, i) => ({
        ...e,
        qrDataUrl: urls[i],
      }));
      this._cdr.markForCheck();
    });
  }

  private _format(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('de-DE', DATE_FORMAT);
  }
}
