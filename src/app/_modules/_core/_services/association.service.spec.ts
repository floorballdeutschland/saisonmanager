import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { take } from 'rxjs';

import { AssociationService } from './association.service';
import { environment } from 'src/environments/environment';

describe('AssociationService', () => {
  let service: AssociationService;
  let httpMock: HttpTestingController;

  const initUrl = `${environment.apiURL}init.json`;
  const initPayload = {
    seasons: [],
    current_season_id: 18,
    game_operations: [],
    state_associations: [],
    info_links: {
      minor_privacy_bundesliga: 'https://floorball.de/alt.pdf',
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
    });
    // Der Konstruktor lädt init – erst nach dem Abonnieren flushen.
    service = TestBed.inject(AssociationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  describe('infoLinks', () => {
    it('liefert die Adresse aus init', () => {
      let url: string | null | undefined;
      service
        .infoLinkUrl$('minor_privacy_bundesliga')
        .pipe(take(1))
        .subscribe((u) => (url = u));

      httpMock.expectOne(initUrl).flush(initPayload);

      expect(url).toBe('https://floorball.de/alt.pdf');
    });

    it('liefert null für einen Key ohne gepflegte Adresse', () => {
      let url: string | null | undefined;
      service
        .infoLinkUrl$('minor_privacy_bundesliga')
        .pipe(take(1))
        .subscribe((u) => (url = u));

      httpMock.expectOne(initUrl).flush({ ...initPayload, info_links: {} });

      expect(url).toBeNull();
    });

    // Kein Zwischenstand vor init: Ein take(1) direkt nach dem Abonnieren darf
    // nicht die noch leere Override-Liste erwischen.
    it('emittiert erst, wenn init geladen ist', () => {
      let emitted = false;
      service.infoLinks$.pipe(take(1)).subscribe(() => (emitted = true));

      expect(emitted).toBeFalse();

      httpMock.expectOne(initUrl).flush(initPayload);

      expect(emitted).toBeTrue();
    });

    it('setInfoLink überschreibt die Adresse aus init', () => {
      httpMock.expectOne(initUrl).flush(initPayload);

      service.setInfoLink(
        'minor_privacy_bundesliga',
        'https://floorball.de/neu.pdf'
      );

      let url: string | null | undefined;
      service
        .infoLinkUrl$('minor_privacy_bundesliga')
        .pipe(take(1))
        .subscribe((u) => (url = u));

      expect(url).toBe('https://floorball.de/neu.pdf');
    });

    it('setInfoLink mit null entfernt die Adresse', () => {
      httpMock.expectOne(initUrl).flush(initPayload);

      service.setInfoLink('minor_privacy_bundesliga', null);

      let url: string | null | undefined;
      service
        .infoLinkUrl$('minor_privacy_bundesliga')
        .pipe(take(1))
        .subscribe((u) => (url = u));

      expect(url).toBeNull();
    });
  });
});
