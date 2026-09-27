import { TestBed } from '@angular/core/testing';

import { MatchComponent } from './match.component';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap, Params } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

describe('MatchComponent', () => {
  let params$: BehaviorSubject<Params>;

  beforeEach(async () => {
    params$ = new BehaviorSubject<Params>({ matchId: '1' });
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [MatchComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            params: params$,
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MatchComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Beim Wechsel in ein anderes Spiel kann eine Antwort fuer das alte noch
  // unterwegs sein. Kommt sie nach der des neuen an, darf sie das neue Spiel
  // nicht wieder verdraengen: Die Kadermaske schriebe sonst die Spieler des
  // angezeigten Spiels in das der Adresse.
  it('verwirft eine verspaetete Antwort fuer das vorherige Spiel', () => {
    sessionStorage.removeItem('secretary_token');
    const fixture = TestBed.createComponent(MatchComponent);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);

    component.ngOnInit();
    const alt = http.expectOne((r) => r.url.endsWith('games/1.json'));

    params$.next({ matchId: '2' });
    const neu = http.expectOne((r) => r.url.endsWith('games/2.json'));

    neu.flush({ id: 2 });
    alt.flush({ id: 1 });

    expect(component.game?.id).toBe(2);
    component.ngOnDestroy();
  });
});
