import { TestBed } from '@angular/core/testing';

import { TeamSquadPlayerComponent } from './team-squad-player.component';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { PlayerWithLicense } from '@floorball/types';

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
      http.expectOne((r) => r.url.includes('/lineup/home/add_player'));
      http.verify();
    });
  });
});
