import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { InfoLinkService } from './info-link.service';
import { environment } from 'src/environments/environment';

describe('InfoLinkService', () => {
  let service: InfoLinkService;
  let httpMock: HttpTestingController;

  const url = `${environment.apiURL}admin/info_links`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(InfoLinkService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lädt die Links', () => {
    service.adminGetInfoLinks().subscribe((links) => {
      expect(links.length).toBe(1);
      expect(links[0].key).toBe('minor_privacy_bundesliga');
    });

    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush([
      { key: 'minor_privacy_bundesliga', url: 'https://floorball.de/a.pdf' },
    ]);
  });

  it('speichert eine Adresse unter dem Key, nicht unter einer id', () => {
    service
      .adminUpdateInfoLink(
        'minor_privacy_bundesliga',
        'https://floorball.de/neu.pdf'
      )
      .subscribe();

    const req = httpMock.expectOne(`${url}/minor_privacy_bundesliga`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      info_link: { url: 'https://floorball.de/neu.pdf' },
    });
    req.flush({
      key: 'minor_privacy_bundesliga',
      url: 'https://floorball.de/neu.pdf',
    });
  });

  it('schickt eine leere Adresse mit, um den Link zu entfernen', () => {
    service.adminUpdateInfoLink('minor_privacy_bundesliga', '').subscribe();

    const req = httpMock.expectOne(`${url}/minor_privacy_bundesliga`);
    expect(req.request.body).toEqual({ info_link: { url: '' } });
    req.flush({ key: 'minor_privacy_bundesliga', url: null });
  });
});
