import { NO_ERRORS_SCHEMA } from '@angular/core';
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
import { SessionService } from '@floorball/core';
import { User } from '@floorball/types';
import matchDe from '../../../../../../../assets/i18n/match/de.json';

describe('MatchComponent', () => {
  let params$: BehaviorSubject<Params>;

  beforeEach(async () => {
    params$ = new BehaviorSubject<Params>({ matchId: '1' });
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        // Echte Texte, damit Empfänger und Dateiname im DOM prüfbar sind.
        getTranslocoTestingModule({ de: { match: matchDe } }),
      ],
      declarations: [MatchComponent],
      // Der Upload-Bereich wird gerendert, die Kindkomponenten des Spiels
      // (fb-match-public) gehören nicht zu diesem Test.
      schemas: [NO_ERRORS_SCHEMA],
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
  // api#789: Ob ein Berichtsformular verlangt ist und wohin es geht, kommt aus
  // der API. Die Seite prüfte vorher selbst die Straf-id 5, also nur die
  // technische Matchstrafe.
  describe('Berichtsformular', () => {
    function loadAs(
      report: Record<string, unknown>,
      game: Record<string, unknown> = {
        id: 1,
        game_status: 'match_record_closed',
        events: [{ penalty_id: '6' }],
      }
    ) {
      sessionStorage.removeItem('secretary_token');
      TestBed.inject(SessionService).currentUser = { id: 7 } as User;
      const fixture = TestBed.createComponent(MatchComponent);
      const component = fixture.componentInstance;
      const http = TestBed.inject(HttpTestingController);

      component.ngOnInit();
      http.expectOne((r) => r.url.endsWith('games/1.json')).flush(game);
      http
        .expectOne((r) => r.url.endsWith('additional_fields.json'))
        .flush({ special_event: false });
      http.expectOne((r) => r.url.endsWith('referee_report')).flush(report);
      return { fixture, component, http };
    }

    afterEach(() => {
      TestBed.inject(SessionService).currentUser = undefined;
    });

    it('folgt dem Flag der API, nicht der Straf-id', () => {
      const { component } = loadAs({
        uploaded: false,
        required: true,
        recipient: 'vsk',
      });

      expect(component.hasIncidentReport).toBeTrue();
      expect(component.refereeReportRecipient).toBe('vsk');
      component.ngOnDestroy();
    });

    it('zeigt keinen Upload-Bereich, wenn die API keinen Bericht verlangt', () => {
      const { component } = loadAs(
        { uploaded: false, required: false, recipient: null },
        {
          id: 1,
          game_status: 'match_record_closed',
          events: [{ penalty_id: '5' }],
        }
      );

      expect(component.hasIncidentReport).toBeFalse();
      component.ngOnDestroy();
    });

    it('nennt im Hinweis den Empfänger aus der API', () => {
      const { fixture, component } = loadAs({
        uploaded: false,
        required: true,
        recipient: 'sbk',
      });
      component.isLoggedIn$ = new BehaviorSubject(true);
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain(matchDe.refereeReport.forwardedTo.sbk);
      expect(text).not.toContain('zuständige VSK');
      component.ngOnDestroy();
    });

    it('rendert keinen Upload-Bereich, wenn die API keinen Bericht verlangt', () => {
      const { fixture, component } = loadAs({
        uploaded: false,
        required: false,
        recipient: null,
      });
      component.isLoggedIn$ = new BehaviorSubject(true);
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).not.toContain(matchDe.refereeReport.title);
      component.ngOnDestroy();
    });

    it('nennt im Erfolgstext Dateiname und Empfänger', () => {
      const { fixture, component } = loadAs({
        uploaded: true,
        filename: 'bericht.pdf',
        required: true,
        recipient: 'vsk',
      });
      component.isLoggedIn$ = new BehaviorSubject(true);
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain(
        'bericht.pdf wurde hochgeladen und an die VSK weitergeleitet.'
      );
      component.ngOnDestroy();
    });

    it('setzt den Upload-Zustand beim Spielwechsel sofort zurück, auch wenn das neue Spiel scheitert', () => {
      const { component, http } = loadAs({
        uploaded: true,
        filename: 'alt.pdf',
        required: true,
        recipient: 'vsk',
      });

      params$.next({ matchId: '2' });
      expect(component.hasIncidentReport).toBeFalse();
      expect(component.refereeReportUploaded).toBeFalse();
      expect(component.refereeReportFilename).toBe('');
      expect(component.refereeReportRecipient).toBeNull();

      http
        .expectOne((r) => r.url.endsWith('games/2.json'))
        .flush({
          id: 2,
          game_status: 'match_record_closed',
        });
      http
        .expectOne((r) => r.url.endsWith('additional_fields.json'))
        .flush('kaputt', { status: 500, statusText: 'Server Error' });

      expect(component.game?.id).toBe(2);
      expect(component.hasIncidentReport).toBeFalse();
      expect(component.refereeReportFilename).toBe('');
      component.ngOnDestroy();
    });

    it('verwirft die Antwort eines Uploads, der vor dem Spielwechsel begann', () => {
      const { component, http } = loadAs({
        uploaded: false,
        required: true,
        recipient: 'vsk',
      });
      const file = new File(['x'], 'alt.pdf', { type: 'application/pdf' });
      component.onRefereeReportFile({
        target: { files: [file] },
      } as unknown as Event);
      const upload = http.expectOne(
        (r) => r.method === 'POST' && r.url.endsWith('games/1/referee_report')
      );

      params$.next({ matchId: '2' });
      upload.flush({ success: true, filename: 'alt.pdf' });

      expect(component.refereeReportUploaded).toBeFalse();
      expect(component.refereeReportFilename).toBe('');
      component.ngOnDestroy();
    });
  });
});
