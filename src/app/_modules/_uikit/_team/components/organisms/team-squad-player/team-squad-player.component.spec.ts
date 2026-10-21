import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TeamSquadPlayerComponent } from './team-squad-player.component';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { PlayerWithLicense } from '@floorball/types';
import { CurrentAgePipe } from 'src/app/_modules/_uikit/_player/pipes/current-age.pipe';

describe('TeamSquadPlayerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [TeamSquadPlayerComponent],
      // Die Adresse zeigt schon das naechste Spiel. Genau so sah es im Spiel
      // 61889 aus, als die Kadermaske des Folgespiels noch offen war.
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { params: of({ matchId: '61890' }) },
        },
      ],
    })
      .overrideTemplate(TeamSquadPlayerComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(TeamSquadPlayerComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('schreibt in das Spiel, dessen Kader sie zeigt, nicht in das der Adresse', () => {
    const fixture = TestBed.createComponent(TeamSquadPlayerComponent);
    const component = fixture.componentInstance;
    component.gameId = 61889;
    component.side = 'home';
    component.lineup = [];
    component.gamePlayerEntry = null;
    component.player = { id: 21082 } as PlayerWithLicense;
    fixture.detectChanges();

    component.trikotNumber = '19';
    component.addLinupPlayer();

    const http = TestBed.inject(HttpTestingController);
    const req = http.expectOne((r) =>
      r.url.includes('/lineup/home/add_player')
    );
    expect(req.request.url).toContain('user/games/61889/');
    expect(req.request.body.player_id).toBe(21082);
    http.verify();
  });

  describe('bei vollem Kader (api#784)', () => {
    function setup(entry: { trikot_number: number } | null) {
      const fixture = TestBed.createComponent(TeamSquadPlayerComponent);
      const component = fixture.componentInstance;
      component.gameId = 61889;
      component.side = 'home';
      component.lineup = entry ? [entry as never] : [];
      component.gamePlayerEntry = entry as never;
      component.player = { id: 21082 } as PlayerWithLicense;
      component.lineupFull = true;
      fixture.detectChanges();
      return component;
    }

    it('trägt keine neue Person ein', () => {
      const component = setup(null);
      component.trikotNumber = '19';
      component.addLinupPlayer();

      TestBed.inject(HttpTestingController).verify();
      expect(component.addBlocked()).toBeTrue();
    });

    it('lässt die Nummer einer aufgestellten Person ändern', () => {
      const component = setup({ trikot_number: 7 });
      component.trikotNumber = '19';
      component.handleTrikotNumberChange();

      const http = TestBed.inject(HttpTestingController);
      http
        .expectOne((r) => r.url.includes('/lineup/home/remove_player'))
        .flush([]);
      const add = http.expectOne((r) =>
        r.url.includes('/lineup/home/add_player')
      );
      expect(add.request.body.trikot_number).toBe('19');
      expect(component.addBlocked()).toBeFalse();
      http.verify();
    });
  });
});

// Mit echter Vorlage: Die Sperre greift in der Oberflaeche ueber das
// disabled-Attribut des Nummernfelds, nicht erst in addLinupPlayer().
describe('TeamSquadPlayerComponent Vorlage bei vollem Kader (api#784)', () => {
  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule, FormsModule],
      declarations: [TeamSquadPlayerComponent, CurrentAgePipe],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  async function numberInput(
    entry: { trikot_number: number } | null,
    lineupFull: boolean
  ): Promise<HTMLInputElement> {
    const fixture = TestBed.createComponent(TeamSquadPlayerComponent);
    fixture.componentRef.setInput('gameId', 61889);
    fixture.componentRef.setInput('side', 'home');
    fixture.componentRef.setInput('lineup', entry ? [entry] : []);
    fixture.componentRef.setInput('gamePlayerEntry', entry);
    fixture.componentRef.setInput('player', {
      id: 21082,
    } as PlayerWithLicense);
    fixture.componentRef.setInput('lineupFull', lineupFull);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('input[type="number"]');
  }

  it('sperrt das Nummernfeld einer nicht aufgestellten Person', async () => {
    const input = await numberInput(null, true);
    expect(input.disabled).toBeTrue();
    expect(input.title).toBe('Kader voll');
  });

  it('laesst das Nummernfeld einer aufgestellten Person offen', async () => {
    expect(
      (await numberInput({ trikot_number: 7 }, true)).disabled
    ).toBeFalse();
  });

  it('laesst das Nummernfeld offen, solange Platz ist', async () => {
    expect((await numberInput(null, false)).disabled).toBeFalse();
  });
});
