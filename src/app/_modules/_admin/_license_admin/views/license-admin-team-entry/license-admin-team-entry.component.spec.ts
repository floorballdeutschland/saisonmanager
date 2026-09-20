import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { LicenseAdminTeamEntryComponent } from './license-admin-team-entry.component';
import { getTranslocoTestingModule } from '@floorball/core';
import { PlayerLicenseHistory } from '@floorball/models';

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
    fixture.componentInstance.lastHistory = {
      license_status_id: statusId,
    } as PlayerLicenseHistory;
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

  // Bis hierher gab es drei Symbole: Haken, Kreuz und ein Fragezeichen für
  // alles andere. `beantragt` sah damit aus wie `gelöscht`, `zurückgezogen`
  // und `gesperrt`. Jeder Status, den die API kennt (License::NAMES), braucht
  // ein eigenes Zeichen -- und die Prüfung hält fest, dass keine zwei
  // dieselbe Zeichnung tragen.
  it('zeichnet jeden bekannten Status anders', () => {
    const drawings = new Map<number, string>();

    [1, 2, 3, 4, 6, 7, 8, 9].forEach((statusId) => {
      const fixture = render('Lilienthaler Wölfe', 'Liga', statusId);
      drawings.set(statusId, paths(fixture));
    });

    expect(new Set(drawings.values()).size).toBe(drawings.size);
  });

  it('benennt den Status als Tooltip und Vorlesetext', () => {
    const fixture = render('Lilienthaler Wölfe', 'Liga', 1);

    expect(statusText(fixture)).toContain('teamEntry.status.approved');
    expect(icon(fixture).getAttribute('role')).toBe('img');
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

  it('zeigt eine Lizenz ohne History als Fragezeichen', () => {
    const fixture = TestBed.createComponent(LicenseAdminTeamEntryComponent);
    fixture.componentInstance.teamId = 9664;
    fixture.componentInstance.teamName = 'Lilienthaler Wölfe';
    fixture.detectChanges();

    expect(statusText(fixture)).toContain('teamEntry.status.unknown');
  });
});
