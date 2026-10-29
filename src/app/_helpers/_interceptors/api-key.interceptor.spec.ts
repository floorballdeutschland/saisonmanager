import { TestBed } from '@angular/core/testing';
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';
import { ApiKeyInterceptor, PRERENDER_API_KEY } from './api-key.interceptor';

describe('ApiKeyInterceptor', () => {
  const url = `${environment.apiURL}init.json`;

  function setup(providers: unknown[] = []) {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        {
          provide: HTTP_INTERCEPTORS,
          useClass: ApiKeyInterceptor,
          multi: true,
        },
        ...(providers as never[]),
      ],
    });
    return {
      http: TestBed.inject(HttpClient),
      httpMock: TestBed.inject(HttpTestingController),
    };
  }

  afterEach(() => TestBed.resetTestingModule());

  // Der Browser bekommt keinen Key mehr, er weist sich ueber die anonyme
  // Sitzung aus. Ein Key hier stuende wieder im ausgelieferten Bundle.
  it('schickt im Browser keinen Key mit', () => {
    const { http, httpMock } = setup();
    http.get(url).subscribe();

    const req = httpMock.expectOne(url);
    expect(req.request.headers.has('X-Api-Key')).toBeFalse();
    req.flush({});
  });

  it('schickt beim Vorrendern den Prerender-Key mit', () => {
    const { http, httpMock } = setup([
      { provide: PRERENDER_API_KEY, useValue: 'prerender-key' },
    ]);
    http.get(url).subscribe();

    const req = httpMock.expectOne(url);
    expect(req.request.headers.get('X-Api-Key')).toBe('prerender-key');
    req.flush({});
  });

  it('gibt den Key nicht an fremde Adressen', () => {
    const { http, httpMock } = setup([
      { provide: PRERENDER_API_KEY, useValue: 'prerender-key' },
    ]);
    const foreign = 'https://example.org/data.json';
    http.get(foreign).subscribe();

    const req = httpMock.expectOne(foreign);
    expect(req.request.headers.has('X-Api-Key')).toBeFalse();
    req.flush({});
  });
});
