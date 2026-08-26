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
    leagueName?: string | null
  ): ComponentFixture<LicenseAdminTeamEntryComponent> {
    const fixture = TestBed.createComponent(LicenseAdminTeamEntryComponent);
    fixture.componentInstance.teamId = 9664;
    fixture.componentInstance.teamName = teamName;
    fixture.componentInstance.leagueName = leagueName;
    fixture.componentInstance.lastHistory = {
      license_status_id: 2,
    } as PlayerLicenseHistory;
    fixture.detectChanges();
    return fixture;
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
});
