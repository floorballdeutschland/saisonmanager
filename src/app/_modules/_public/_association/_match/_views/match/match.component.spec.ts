import { NO_ERRORS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { MatchComponent } from './match.component';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap, Params } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { SessionService } from '@floorball/core';
import { GameOperation, User } from '@floorball/types';
import matchDe from '../../../../../../../assets/i18n/match/de.json';

// Die Reiterleiste färbt den aktiven Reiter mit dem Verlauf des Verbands.
@Pipe({ name: 'gradient', standalone: false })
class GradientStubPipe implements PipeTransform {
  transform(): string {
    return '';
  }
}

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
      declarations: [MatchComponent, GradientStubPipe],
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

    it('verwirft die Antwort eines Uploads, der vor dem Spielwechsel begann', async () => {
      const { component, http } = loadAs({
        uploaded: false,
        required: true,
        recipient: 'vsk',
      });
      const file = new File(['%PDF-1.4'], 'alt.pdf', {
        type: 'application/pdf',
      });
      await component.onRefereeReportFile({
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

    it('lädt ein Foto gar nicht erst hoch', async () => {
      const { component, http } = loadAs({
        uploaded: false,
        required: true,
        recipient: 'vsk',
      });
      const alertSpy = spyOn(window, 'alert');
      const input = {
        files: [new File(['x'], 'bericht.jpg', { type: 'image/jpeg' })],
        value: 'C:\\fakepath\\bericht.jpg',
      };

      await component.onRefereeReportFile({
        target: input,
      } as unknown as Event);

      http.expectNone((r) => r.method === 'POST');
      expect(alertSpy).toHaveBeenCalledOnceWith(
        'Nur PDF-Dateien bis 5 MB sind zulässig, Fotos werden nicht angenommen.'
      );
      expect(input.value).toBe('');
      expect(component.refereeReportUploading).toBeFalse();
      component.ngOnDestroy();
    });

    it('nennt bei einem zu großen PDF dieselbe Grenze', async () => {
      const { component, http } = loadAs({
        uploaded: false,
        required: true,
        recipient: 'vsk',
      });
      const alertSpy = spyOn(window, 'alert');
      const big = new File(['%PDF-1.4'], 'bericht.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 });

      await component.onRefereeReportFile({
        target: { files: [big], value: 'bericht.pdf' },
      } as unknown as Event);

      http.expectNone((r) => r.method === 'POST');
      expect(alertSpy).toHaveBeenCalledOnceWith(
        'Nur PDF-Dateien bis 5 MB sind zulässig, Fotos werden nicht angenommen.'
      );
      component.ngOnDestroy();
    });

    it('weist ein in .pdf umbenanntes Foto ohne Upload ab', async () => {
      const { component, http } = loadAs({
        uploaded: false,
        required: true,
        recipient: 'vsk',
      });
      const alertSpy = spyOn(window, 'alert');

      await component.onRefereeReportFile({
        target: {
          files: [
            new File(['\x89PNG\r\n\x1a\n'], 'bericht.pdf', {
              type: 'application/pdf',
            }),
          ],
          value: 'bericht.pdf',
        },
      } as unknown as Event);

      http.expectNone((r) => r.method === 'POST');
      expect(alertSpy).toHaveBeenCalledOnceWith(
        'Nur PDF-Dateien bis 5 MB sind zulässig, Fotos werden nicht angenommen.'
      );
      component.ngOnDestroy();
    });

    // Die Absage der API zeigt der ErrorInterceptor an; eine eigene Meldung
    // läge als zweite darüber.
    it('legt bei einer Absage der API keine eigene Meldung darüber', async () => {
      const { component, http } = loadAs({
        uploaded: false,
        required: true,
        recipient: 'vsk',
      });
      const alertSpy = spyOn(window, 'alert');
      const file = new File(['%PDF-1.4'], 'bericht.pdf', {
        type: 'application/pdf',
      });

      await component.onRefereeReportFile({
        target: { files: [file] },
      } as unknown as Event);
      http
        .expectOne(
          (r) => r.method === 'POST' && r.url.endsWith('games/1/referee_report')
        )
        .flush(
          { errors: ['Nur PDF-Dateien bis 5 MB sind zulässig.'] },
          { status: 422, statusText: 'Unprocessable Entity' }
        );

      expect(alertSpy).not.toHaveBeenCalled();
      expect(component.refereeReportUploading).toBeFalse();
      expect(component.refereeReportUploaded).toBeFalse();
      component.ngOnDestroy();
    });
  });

  // fe#344: Der Reiter „Ausführliche Statistik“ gibt es nur bei Spielen, die im
  // Tabletmodus erfasst wurden. Alle anderen Spielseiten bleiben unverändert.
  describe('Reiter Ausführliche Statistik', () => {
    function loadPublic(game: Record<string, unknown>) {
      sessionStorage.removeItem('secretary_token');
      const fixture = TestBed.createComponent(MatchComponent);
      const component = fixture.componentInstance;
      const http = TestBed.inject(HttpTestingController);

      // Der erste Durchlauf ruft ngOnInit; danach erst den Verband setzen,
      // ngOnInit überschriebe ihn sonst.
      fixture.detectChanges();
      component.selectedAssociation$ = of({ id: 1 } as GameOperation);
      http.expectOne((r) => r.url.endsWith('games/1.json')).flush(game);
      fixture.detectChanges();
      return { fixture, component, http };
    }
    const el = (fixture: { nativeElement: unknown }) =>
      fixture.nativeElement as HTMLElement;

    it('fehlt bei Spielen ohne Tablet-Daten, ebenso die ganze Reiterleiste', () => {
      const { fixture, component } = loadPublic({ id: 1 });

      expect(el(fixture).querySelector('[data-test="tab-stats"]')).toBeNull();
      expect(el(fixture).querySelector('fb-tab-item')).toBeNull();
      component.ngOnDestroy();
    });

    it('erscheint bei tablet_capture auch für Besucher ohne Bearbeitungsrecht', () => {
      const { fixture, component } = loadPublic({
        id: 1,
        tablet_capture: true,
      });

      expect(
        el(fixture).querySelector('[data-test="tab-stats"]')?.textContent
      ).toContain('Ausführliche Statistik');
      expect(el(fixture).textContent).not.toContain('Eingabe Spielbericht');
      component.ngOnDestroy();
    });

    it('zeigt die Statistik erst nach Klick auf den Reiter', () => {
      const { fixture, component, http } = loadPublic({
        id: 1,
        tablet_capture: true,
      });
      expect(el(fixture).querySelector('fb-match-detailed-stats')).toBeNull();

      component.setTab('stats');
      // setTab lädt das Spiel neu, ohne Zusatzfelder für Besucher.
      http
        .expectOne((r) => r.url.endsWith('games/1.json'))
        .flush({ id: 1, tablet_capture: true });
      http.expectNone((r) => r.url.endsWith('additional_fields.json'));
      fixture.detectChanges();

      expect(el(fixture).querySelector('fb-match-detailed-stats')).toBeTruthy();
      expect(el(fixture).querySelector('fb-match-public')).toBeNull();
      component.ngOnDestroy();
    });

    it('fällt beim Wechsel in ein Spiel ohne Tablet-Daten auf die Übersicht zurück', () => {
      const { fixture, component, http } = loadPublic({
        id: 1,
        tablet_capture: true,
      });
      component.tab = 'stats';

      params$.next({ matchId: '2' });
      http.expectOne((r) => r.url.endsWith('games/2.json')).flush({ id: 2 });
      fixture.detectChanges();

      expect(component.isTabActive('public')).toBeTrue();
      expect(el(fixture).querySelector('fb-match-detailed-stats')).toBeNull();
      component.ngOnDestroy();
    });
  });
});
