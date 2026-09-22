import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { MatchPublicComponent } from './match-public.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { LeagueService } from '@floorball/core';
import { AwardPlayer, Game } from '@floorball/types';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitMatchesModule } from '@floorball/uikit/matches';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitTeamModule } from '@floorball/uikit/team';

describe('MatchPublicComponent', () => {
  let fixture: ComponentFixture<MatchPublicComponent>;

  const award = (team: string): AwardPlayer =>
    ({
      award: 'mvp',
      team,
      player_id: 7,
      player_firstname: 'Anna',
      player_name: 'Meier',
      trikot_number: 11,
    }) as AwardPlayer;

  const game = (overrides: Partial<Game> = {}): Game =>
    ({
      started: true,
      ended: true,
      events: [],
      events_legacy: [],
      referees: [],
      period_titles: [],
      home_team_name: 'Floorball Berlin 2',
      guest_team_name: 'Hamburg Crocodiles',
      home_team_short_name: 'FBB 2',
      guest_team_short_name: 'Hamburg',
      players: { home: [], guest: [] },
      starting_players: { home: [], guest: [] },
      awards: { home: [award('home')], guest: [award('guest')] },
      home_coaches: [
        {
          slot: 1,
          first_name: 'Anna',
          last_name: 'Meier',
          name: 'Meier, Anna',
        },
      ],
      guest_coaches: [
        {
          slot: 1,
          first_name: 'Bruno',
          last_name: 'Sanchez',
          name: 'Sanchez, Bruno',
        },
      ],
      ...overrides,
    }) as Game;

  const render = (g: Game = game()): HTMLElement => {
    fixture.componentInstance.game = g;
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  };

  const tiles = (host: HTMLElement): HTMLElement[] =>
    Array.from(
      host.querySelectorAll<HTMLElement>('.grid.md\\:grid-cols-2 > div')
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        UikitCommonModule,
        UikitMatchesModule,
        UikitPlayerModule,
        UikitTeamModule,
      ],
      declarations: [MatchPublicComponent],
      providers: [
        {
          provide: LeagueService,
          useValue: { selectedLeague$: of({ id: 1, field_size: 'GF' }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MatchPublicComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Der eigentliche Punkt der Aenderung: einspaltig auf dem Handy liest man die
  // Kacheln in Quelltextreihenfolge. Sie muss deshalb nach Mannschaft laufen
  // und nicht abschnittsweise -- eine reine order-Verschiebung haette nur das
  // Bild gedreht und Tastatur und Screenreader bei der alten Abfolge gelassen.
  it('stellt die Kacheln im Quelltext nach Mannschaft zusammen', () => {
    const host = render();

    const inhalte = tiles(host).map((tile) => tile.textContent ?? '');

    expect(inhalte.length).toBe(6);
    expect(inhalte[0]).toContain('Floorball Berlin 2');
    expect(inhalte[1]).toContain('Starting six');
    expect(inhalte[2]).toContain('Wertvollste:r Spieler:in');
    expect(inhalte[3]).toContain('Hamburg Crocodiles');
    expect(inhalte[4]).toContain('Starting six');
    expect(inhalte[5]).toContain('Wertvollste:r Spieler:in');
  });

  // Das Karma-Fenster ist breiter als der md-Breakpoint und laedt die gebaute
  // Tailwind-Datei. Die zweispaltige Ansicht laesst sich hier deshalb als
  // Wirkung pruefen statt als Klassenname: ein Tippfehler in md:col-start-2
  // faellt auf, ein `toContain` auf die Klasse wuerde ihn durchlassen.
  it('haelt Heim und Gast auf dem Desktop in je einer Spalte', () => {
    const host = render();
    const grid = host.querySelector<HTMLElement>('.grid.md\\:grid-cols-2');

    expect(getComputedStyle(grid!).gridTemplateColumns.split(' ').length)
      .withContext('Karma-Fenster liegt unter dem md-Breakpoint')
      .toBe(2);

    const plaetze = tiles(host).map((tile) => {
      const stil = getComputedStyle(tile);

      return `${stil.gridColumnStart}/${stil.gridRowStart}`;
    });

    expect(plaetze).toEqual(['1/1', '1/2', '1/3', '2/1', '2/2', '2/3']);
  });

  it('setzt jeder Zwischenueberschrift das Kuerzel ihrer eigenen Mannschaft zu', () => {
    const host = render();
    const [heimAufstellung, heimStarting, heimAward] = tiles(host);

    expect(heimAufstellung.textContent).toContain('FBB 2');
    expect(heimStarting.textContent).toContain('FBB 2');
    expect(heimAward.textContent).toContain('FBB 2');
    expect(heimAufstellung.textContent).not.toContain('Hamburg');
  });

  it('blendet das Kuerzel auf dem Desktop aus', () => {
    const host = render();
    const kuerzel = host.querySelector<HTMLElement>(
      'fb-team-section-title h4 span'
    );

    expect(kuerzel?.textContent).toContain('FBB 2');
    expect(getComputedStyle(kuerzel!).display).toBe('none');
  });

  // Ohne Auszeichnungen faellt die Kachel weg, statt als leerer Platz zwei
  // Abstaende zwischen die beiden Mannschaften zu legen.
  it('laesst die Auszeichnungskachel ohne Auszeichnung ganz weg', () => {
    const host = render(game({ awards: { home: [], guest: [] } }));

    expect(tiles(host).length).toBe(4);
  });

  it('nimmt das Kuerzel der API, solange es da ist, und sonst den vollen Namen', () => {
    fixture.componentInstance.game = game({ home_team_short_name: undefined });

    expect(fixture.componentInstance.homeShortName).toBe('Floorball Berlin 2');
    expect(fixture.componentInstance.guestShortName).toBe('Hamburg');
  });

  it('benennt die Starting four im Kleinfeld', () => {
    render();
    expect(fixture.componentInstance.fieldSize).toBe('GF');
    expect(fixture.componentInstance.startingPlayersTitle).toBe('Starting six');

    fixture.componentInstance.fieldSize = 'KF';
    expect(fixture.componentInstance.startingPlayersTitle).toBe(
      'Starting four'
    );
  });
});
