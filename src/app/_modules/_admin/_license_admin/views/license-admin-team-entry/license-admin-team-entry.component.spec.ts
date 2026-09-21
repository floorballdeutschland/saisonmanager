import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { LicenseAdminTeamEntryComponent } from './license-admin-team-entry.component';
import { getTranslocoTestingModule } from '@floorball/core';

/**
 * Der Transloco-Scope `admin/license` hängt am AdminLicenseModule. Die
 * Komponente steht hier allein im TestBed, der Alias `licenseAdmin` löst also
 * nicht auf und die Vorlage rendert die rohen Schlüssel. Für diese Prüfungen ist
 * das brauchbar: Am gerenderten Schlüssel lässt sich der genommene Zweig
 * ablesen. Der Liganame steht ohne Pipe in der Vorlage und kommt im Klartext an.
 */
describe('LicenseAdminTeamEntryComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, getTranslocoTestingModule()],
      declarations: [LicenseAdminTeamEntryComponent],
    }).compileComponents();
  });

  function render(
    teamName?: string | null,
    leagueName?: string | null,
    statusId: unknown = 2
  ): ComponentFixture<LicenseAdminTeamEntryComponent> {
    const fixture = TestBed.createComponent(LicenseAdminTeamEntryComponent);
    fixture.componentInstance.teamId = 9664;
    fixture.componentInstance.teamName = teamName;
    fixture.componentInstance.leagueName = leagueName;
    fixture.componentInstance.statusId = statusId as number;
    fixture.detectChanges();
    return fixture;
  }

  function icon(
    fixture: ComponentFixture<LicenseAdminTeamEntryComponent>
  ): SVGSVGElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      'svg'
    ) as SVGSVGElement;
  }

  function statusText(
    fixture: ComponentFixture<LicenseAdminTeamEntryComponent>
  ): string {
    return icon(fixture).querySelector('title')?.textContent?.trim() ?? '';
  }

  function paths(
    fixture: ComponentFixture<LicenseAdminTeamEntryComponent>
  ): string {
    return Array.from(icon(fixture).querySelectorAll('path'))
      .map((p) => p.getAttribute('d'))
      .join('|');
  }

  function text(
    fixture: ComponentFixture<LicenseAdminTeamEntryComponent>
  ): string {
    return (
      (fixture.nativeElement as HTMLElement).textContent
        ?.replace(/\s+/g, ' ')
        .trim() ?? ''
    );
  }

  // Der Kern des Fixes: Vorher holte die Zeile in ngOnInit `admin/teams/:id`
  // nach. Dieser Abruf ist auf den Spielbetrieb der Liga der Mannschaft begrenzt
  // (TeamsController#can_read_admin_team?), antwortete bei einer Zweitlizenz in
  // einem fremden Verband mit 403 und warf die zuständige SBK über den
  // allgemeinen 403-Zweig aus ihrer EIGENEN Liga auf die Startseite. Ohne
  // Anfrage kann das nicht mehr passieren.
  it('stellt keine Anfrage, um die Mannschaft zu benennen', () => {
    render('Lilienthaler Wölfe', '2. FBL Herren Nord/West');

    const http = TestBed.inject(HttpTestingController);
    expect(http.match(() => true).length).toBe(0);
    http.verify();
  });

  it('rendert den Liganamen aus der Eingabe', () => {
    const fixture = render('Lilienthaler Wölfe', '2. FBL Herren Nord/West');

    expect(text(fixture)).toContain('2. FBL Herren Nord/West');
  });

  it('nimmt mit Namen den Zweig mit Name und Kennung', () => {
    const fixture = render('Lilienthaler Wölfe', '2. FBL Herren Nord/West');

    expect(text(fixture)).toContain('teamEntry.teamLabel');
    expect(text(fixture)).not.toContain('teamEntry.teamIdOnly');
  });

  // Gelöschte Mannschaft oder eine API vor api#555: Die Kennung allein sagt
  // weniger als der Name, aber mehr als eine leere Zeile.
  it('nimmt ohne Namen den Zweig mit der Kennung allein', () => {
    const fixture = render(null, null);

    expect(text(fixture)).toContain('teamEntry.teamIdOnly');
    expect(text(fixture)).not.toContain('teamEntry.teamLabel');
  });

  // Die Status aus License::NAMES mit ihrem Klartext und ihrer Farbfamilie.
  // Handgeschrieben und nicht aus STATUS_ICONS abgeleitet: Die Liste ist der
  // Vertrag mit der API, eine Ableitung aus der Tabelle prüfte sich selbst.
  // Die 5 fehlt, weil die API sie ersatzlos gestrichen hat und nicht neu
  // vergibt -- sie taugt deshalb unten als unbekannter Status.
  const KNOWN_STATUSES: [number, string, string][] = [
    [1, 'approved', 'text-green-600'],
    [2, 'requested', 'text-yellow-600'],
    [3, 'denied', 'text-red-600'],
    [4, 'deleted', 'text-fb-gray-400'],
    [6, 'transfer', 'text-fb-gray-400'],
    [7, 'ignored', 'text-fb-gray-400'],
    [8, 'withdrawn', 'text-fb-gray-400'],
    [9, 'suspended', 'text-red-600'],
  ];

  // Bis hierher gab es drei Symbole: Haken, Kreuz und ein Fragezeichen für
  // alles andere. `beantragt` sah damit aus wie `gelöscht`, `zurückgezogen`
  // und `gesperrt`. Die Prüfung hält fest, dass die hier gelisteten Status
  // paarweise verschiedene Zeichnungen tragen -- eine Abdeckungszusage
  // gegenüber der API ist sie nicht, dafür müsste die Liste mitwachsen.
  it('zeichnet jeden gelisteten Status anders', () => {
    const drawings = new Map<string, number>();

    KNOWN_STATUSES.forEach(([statusId]) => {
      const drawing = paths(render('Lilienthaler Wölfe', 'Liga', statusId));
      const collision = drawings.get(drawing);
      expect(collision)
        .withContext(`Status ${statusId} zeichnet wie Status ${collision}`)
        .toBeUndefined();
      drawings.set(drawing, statusId);
    });
  });

  // Die Verschiedenheit allein genügt nicht: Vertauscht man zwei Einträge
  // derselben Farbe -- `gelöscht` und `zurückgezogen` etwa --, bleibt jede
  // Zeichnung verschieden, der Tooltip benennt aber den falschen Status. Diese
  // Prüfung bindet jede Kennung an ihren Klartext.
  it('benennt jeden gelisteten Status im Klartext', () => {
    KNOWN_STATUSES.forEach(([statusId, key]) => {
      const fixture = render('Lilienthaler Wölfe', 'Liga', statusId);

      expect(statusText(fixture))
        .withContext(`Status ${statusId}`)
        .toContain(`teamEntry.status.${key}`);
    });
  });

  // Die Farbe beantwortet die Spielberechtigung und folgt derselben
  // Einteilung wie licenseStatusBadgeClass. Ohne diese Prüfung fiele ein
  // entferntes [ngClass] oder eine rot gemeinte Sperre in Grün nicht auf.
  it('färbt jeden gelisteten Status nach seiner Spielberechtigung', () => {
    KNOWN_STATUSES.forEach(([statusId, , colorClass]) => {
      const fixture = render('Lilienthaler Wölfe', 'Liga', statusId);

      expect(icon(fixture).getAttribute('class'))
        .withContext(`Status ${statusId}`)
        .toContain(colorClass);
    });
  });

  it('benennt den Status als Tooltip und Vorlesetext', () => {
    const fixture = render('Lilienthaler Wölfe', 'Liga', 1);

    expect(statusText(fixture)).toContain('teamEntry.status.approved');
    expect(icon(fixture).getAttribute('role')).toBe('img');
  });

  // Die Pfade sind im 24er-Raster gezeichnet; mit der vorherigen 22 saß die
  // Zeichnung neben der Mitte der Box.
  it('spannt den viewBox über das Raster der Pfade', () => {
    const fixture = render('Lilienthaler Wölfe', 'Liga', 1);

    expect(icon(fixture).getAttribute('viewBox')).toBe('0 0 24 24');
  });

  // Die Status-ID liegt in der JSONB-History nicht typgarantiert vor. Der
  // vorherige `@switch` in der Vorlage verglich streng, eine erteilte Lizenz
  // mit '1' als Zeichenkette zeigte also das Fragezeichen. Hält fest, dass
  // beide Schreibweisen dasselbe Symbol bekommen -- ein Umbau zurück auf einen
  // strengen Vergleich fällt hier auf.
  it('liest die Status-ID auch als Zeichenkette', () => {
    const asString = render('Lilienthaler Wölfe', 'Liga', '1');
    const asNumber = render('Lilienthaler Wölfe', 'Liga', 1);

    expect(paths(asString)).toBe(paths(asNumber));
    expect(statusText(asString)).toContain('teamEntry.status.approved');
  });

  // Das Fragezeichen bleibt, aber nur für den Rest: ein Status, den diese
  // Fassung nicht kennt, und eine Lizenz ohne History.
  it('zeigt einen unbekannten Status als Fragezeichen', () => {
    const unknown = render('Lilienthaler Wölfe', 'Liga', 5);

    expect(statusText(unknown)).toContain('teamEntry.status.unknown');
  });

  // Fehlt der Status im JSONB, erreicht er die Leitung als 0 (die API rechnet
  // mit `to_i`) oder als null. Beides ist kein Status und darf nicht als
  // erteilt gelesen werden.
  it('zeigt einen fehlenden Status als Fragezeichen', () => {
    expect(statusText(render('Lilienthaler Wölfe', 'Liga', 0))).toContain(
      'teamEntry.status.unknown'
    );
    expect(statusText(render('Lilienthaler Wölfe', 'Liga', null))).toContain(
      'teamEntry.status.unknown'
    );
  });

  it('zeigt eine Lizenz ohne Statuskennung als Fragezeichen', () => {
    const fixture = TestBed.createComponent(LicenseAdminTeamEntryComponent);
    fixture.componentInstance.teamId = 9664;
    fixture.componentInstance.teamName = 'Lilienthaler Wölfe';
    fixture.detectChanges();

    expect(statusText(fixture)).toContain('teamEntry.status.unknown');
  });
});
