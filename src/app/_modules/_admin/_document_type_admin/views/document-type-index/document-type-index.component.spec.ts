import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AssociationService, getTranslocoTestingModule } from '@floorball/core';
import { InfoLink } from '@floorball/types';
import { environment } from 'src/environments/environment';
import { DocumentTypeIndexComponent } from './document-type-index.component';

describe('DocumentTypeIndexComponent', () => {
  const infoLinksUrl = `${environment.apiURL}admin/info_links`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [DocumentTypeIndexComponent],
    })
      .overrideTemplate(DocumentTypeIndexComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(DocumentTypeIndexComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('Links auf Informationsblätter', () => {
    let fixture: ComponentFixture<DocumentTypeIndexComponent>;
    let component: DocumentTypeIndexComponent;
    let httpMock: HttpTestingController;

    const link: InfoLink = {
      key: 'minor_privacy_bundesliga',
      url: 'https://floorball.de/alt.pdf',
    };

    beforeEach(() => {
      httpMock = TestBed.inject(HttpTestingController);
      fixture = TestBed.createComponent(DocumentTypeIndexComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('übernimmt die geladenen Links', () => {
      httpMock.expectOne(infoLinksUrl).flush([link]);

      expect(component.infoLinks).toEqual([link]);
      expect(component.infoLinksLoadFailed).toBeFalse();
    });

    // Ein Ladefehler darf nicht wie „keine Adresse gepflegt" aussehen – sonst
    // trägt jemand eine bereits gepflegte Adresse erneut ein.
    it('merkt sich einen Ladefehler statt eine leere Liste zu zeigen', () => {
      httpMock
        .expectOne(infoLinksUrl)
        .flush({}, { status: 500, statusText: 'Server Error' });

      expect(component.infoLinksLoadFailed).toBeTrue();
      expect(component.infoLinks).toEqual([]);
    });

    it('schickt die getrimmte Adresse und ersetzt die Zeile', () => {
      httpMock.expectOne(infoLinksUrl).flush([link]);

      component.startEditInfoLink(link);
      expect(component.infoLinkBuffer).toBe('https://floorball.de/alt.pdf');

      component.infoLinkBuffer = '  https://floorball.de/neu.pdf  ';
      component.saveInfoLink();

      const req = httpMock.expectOne(`${infoLinksUrl}/${link.key}`);
      expect(req.request.body).toEqual({
        info_link: { url: 'https://floorball.de/neu.pdf' },
      });
      req.flush({ key: link.key, url: 'https://floorball.de/neu.pdf' });

      expect(component.infoLinks[0].url).toBe('https://floorball.de/neu.pdf');
      expect(component.editingInfoLinkKey).toBeNull();
      expect(component.savingInfoLink).toBeFalse();
    });

    // init wird nur beim Seitenaufbau geladen. Ohne das Nachziehen zeigte der
    // Lizenzantrag nach dem Korrigieren weiter die alte, tote Adresse.
    it('zieht die neue Adresse im AssociationService nach', () => {
      const associationService = TestBed.inject(AssociationService);
      const setInfoLink = spyOn(associationService, 'setInfoLink');

      httpMock.expectOne(infoLinksUrl).flush([link]);
      component.startEditInfoLink(link);
      component.infoLinkBuffer = 'https://floorball.de/neu.pdf';
      component.saveInfoLink();
      httpMock
        .expectOne(`${infoLinksUrl}/${link.key}`)
        .flush({ key: link.key, url: 'https://floorball.de/neu.pdf' });

      expect(setInfoLink).toHaveBeenCalledWith(
        link.key,
        'https://floorball.de/neu.pdf'
      );
    });

    it('bleibt nach einem Fehler in der Bearbeitung', () => {
      httpMock.expectOne(infoLinksUrl).flush([link]);

      component.startEditInfoLink(link);
      component.infoLinkBuffer = 'floorball.de/ohne-schema.pdf';
      component.saveInfoLink();

      httpMock
        .expectOne(`${infoLinksUrl}/${link.key}`)
        .flush(
          { error: 'Der Link muss mit http:// oder https:// beginnen.' },
          { status: 422, statusText: 'Unprocessable Content' }
        );

      expect(component.editingInfoLinkKey).toBe(link.key);
      expect(component.savingInfoLink).toBeFalse();
      expect(component.infoLinks[0].url).toBe('https://floorball.de/alt.pdf');
    });
  });
});
