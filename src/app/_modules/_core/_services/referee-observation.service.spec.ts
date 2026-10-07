import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { RefereeObservationService } from './referee-observation.service';
import { environment } from 'src/environments/environment';

describe('RefereeObservationService', () => {
  let service: RefereeObservationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(RefereeObservationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('schickt nur gesetzte Filter an die Übersicht', () => {
    service
      .adminGetReport({ status: 'all', coach_id: 9, season_id: '18' })
      .subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiURL}admin/referee_observation_report`
    );
    expect(req.request.params.keys().sort()).toEqual([
      'coach_id',
      'season_id',
      'status',
    ]);
    expect(req.request.params.get('coach_id')).toBe('9');
    req.flush({ filters: {}, options: {}, observations: [] });
  });

  // Rails liest eine Liste nur als `ids[]`; ein blankes `ids` käme als
  // einzelner Wert an und exportierte nur den letzten Bogen.
  it('schickt die Auswahl als ids[] an den Export', () => {
    service
      .adminExportReport('xlsx', { status: 'visible' }, [3, 5])
      .subscribe();

    const req = httpMock.expectOne(
      (r) =>
        r.url ===
        `${environment.apiURL}admin/referee_observation_report/export.xlsx`
    );
    expect(req.request.responseType).toBe('blob');
    expect(req.request.params.getAll('ids[]')).toEqual(['3', '5']);
    expect(req.request.params.get('status')).toBe('visible');
    req.flush(new Blob(['x']));
  });
});
