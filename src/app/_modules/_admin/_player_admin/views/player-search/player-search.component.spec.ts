import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';

import { PlayerSearchComponent } from './player-search.component';
import { PlayerService, getTranslocoTestingModule } from '@floorball/core';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { PlayerSearchResult } from '@floorball/models';

describe('PlayerSearchComponent', () => {
  // Die Komponente steht hier ohne ihr Modul und damit ohne dessen
  // TRANSLOCO_SCOPE. Die Keys muessen deshalb global unter dem Alias stehen,
  // den das Modul vergibt ("playerAdmin"), sonst rendert die Vorlage die rohen
  // Keys und die Tabelle bleibt wirkungslos.
  const translations = {
    de: {
      playerAdmin: {
        common: { title: 'Spieler' },
        search: {
          globalSearch: 'Globale Spielersuche',
          search: 'Suche',
          searchPlaceholder: 'Vor- oder Nachname',
          results: 'Ergebnisse',
          searching: 'wird gesucht...',
          noResults: 'Keine Spieler gefunden.',
          minChars: 'Mindestens 2 Zeichen eingeben.',
          deactivatedBadge: 'deaktiviert',
          noAccessBadge: 'kein Zugriff',
          noAccessHint: 'Zustaendig ist {{association}}.',
          noAccessHintUnknown: 'Kein Spielbetrieb zustaendig.',
        },
      },
    },
  };

  function treffer(overrides: Partial<PlayerSearchResult> = {}) {
    return {
      id: 1,
      last_name: 'Blok',
      first_name: 'Chiel',
      birthdate: '2005-11-16',
      gender: 'm',
      club_id: 202,
      ...overrides,
    } as PlayerSearchResult;
  }

  async function setup(results: PlayerSearchResult[]) {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        FormsModule,
        UikitPlayerModule,
        getTranslocoTestingModule(translations),
      ],
      declarations: [PlayerSearchComponent],
      providers: [
        {
          provide: PlayerService,
          useValue: { globalSearch: () => of(results) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PlayerSearchComponent);
    fixture.componentInstance.results = results;
    fixture.componentInstance.searched = true;
    fixture.detectChanges();
    return fixture;
  }

  it('should create', async () => {
    const fixture = await setup([]);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Deaktivierte Profile sind seit api#472 Teil des Ergebnisses. Ohne einen
  // Hinweis am Treffer waere nicht zu erkennen, warum die Person in der
  // Vereinsliste ihres Vereins fehlt.
  it('kennzeichnet einen deaktivierten Treffer', async () => {
    const fixture = await setup([
      treffer({ deactivated_at: '2026-07-25T09:46:55Z' }),
    ]);

    expect(fixture.nativeElement.textContent).toContain('Blok, Chiel');
    expect(fixture.nativeElement.textContent).toContain('deaktiviert');
  });

  it('kennzeichnet einen aktiven Treffer nicht', async () => {
    const fixture = await setup([treffer()]);

    expect(fixture.nativeElement.textContent).toContain('Blok, Chiel');
    expect(fixture.nativeElement.textContent).not.toContain('deaktiviert');
  });

  // Der Regressionsfall: Die Suche geht ueber den gesamten Bestand, das Profil
  // dahinter ist auf den Heimat-Spielbetrieb begrenzt. Ein Link auf einen
  // Treffer aus einem anderen Landesverband endete mit 403 und warf ueber den
  // ErrorInterceptor auf die Startseite, samt Suchbegriff und Trefferliste.
  it('verlinkt einen Treffer ohne Zugriff nicht und nennt den zustaendigen Verband', async () => {
    const fixture = await setup([
      treffer({ manageable: false, responsible: 'SBK Ost' }),
    ]);

    expect(fixture.nativeElement.textContent).toContain('Blok, Chiel');
    expect(fixture.nativeElement.textContent).toContain('kein Zugriff');
    expect(fixture.nativeElement.textContent).toContain(
      'Zustaendig ist SBK Ost.'
    );
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="locked-result"]')
    ).toBeTruthy();
  });

  // Ohne gueltige Heimat-Zugehoerigkeit ist niemand zustaendig (api#389). Der
  // Hinweis darf dann keinen Verband erfinden.
  it('nennt ohne zustaendigen Verband den allgemeinen Hinweis', async () => {
    const fixture = await setup([
      treffer({ manageable: false, responsible: null }),
    ]);

    expect(fixture.nativeElement.textContent).toContain(
      'Kein Spielbetrieb zustaendig.'
    );
  });

  it('verlinkt einen Treffer mit Zugriff', async () => {
    const fixture = await setup([treffer({ manageable: true })]);

    const link = fixture.nativeElement.querySelector('a');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe(
      '/verwaltung/vereine/202/spieler/1/bearbeiten'
    );
    expect(fixture.nativeElement.textContent).not.toContain('kein Zugriff');
  });

  // Eine Antwort ohne das Feld (aeltere API) darf die Trefferliste nicht
  // sperren: Der Link ist der Normalfall, die Sperre die Ausnahme.
  it('verlinkt einen Treffer ohne die Angabe wie bisher', async () => {
    const fixture = await setup([treffer()]);

    expect(fixture.nativeElement.querySelector('a')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('kein Zugriff');
  });
});
