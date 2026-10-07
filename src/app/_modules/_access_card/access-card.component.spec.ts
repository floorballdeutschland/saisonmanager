import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccessCardComponent } from './access-card.component';

describe('AccessCardComponent', () => {
  let fixture: ComponentFixture<AccessCardComponent>;
  let component: AccessCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AccessCardComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AccessCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Spielsekretariat');
    fixture.componentRef.setInput('subject', 'Sa., 10.10.2026 · Halle Nord');
  });

  // QRCode.toDataURL ist asynchron; die Karte zeigt erst danach Bilder.
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();
  }

  it('zeigt je Adresse einen QR-Code', async () => {
    fixture.componentRef.setInput('entries', [
      {
        label: 'Bühne',
        url: 'https://saisonmanager.de/overlay/index.html?token=a',
      },
      {
        label: 'Bedienfeld',
        url: 'https://saisonmanager.de/overlay/dock.html?token=a',
      },
    ]);
    await settle();

    const images: HTMLImageElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('img')
    );
    expect(images.length).toBe(2);
    expect(images[0].src).toMatch(/^data:image\/png;base64,/);
    expect(images[1].alt).toBe('QR-Code: Bedienfeld');
  });

  // Die Uhrzeit muss die des Spielbetriebs sein, nicht die des Rechners: Der
  // Server rechnet das Fenster in Europe/Berlin.
  it('nennt den Zeitraum in deutscher Zeit', () => {
    fixture.componentRef.setInput('validFrom', '2026-10-06T22:00:00Z');
    fixture.componentRef.setInput('expiresAt', '2026-10-11T21:59:59Z');

    expect(component.validity).toBe(
      'Gültig von Mi., 07.10.2026, 00:00 Uhr bis So., 11.10.2026, 23:59 Uhr'
    );
  });

  it('kommt ohne Beginn aus (ältere API, Altbestand)', () => {
    fixture.componentRef.setInput('validFrom', null);
    fixture.componentRef.setInput('expiresAt', '2026-10-11T21:59:59Z');

    expect(component.validity).toBe('Gültig bis So., 11.10.2026, 23:59 Uhr');
  });

  describe('Drucken', () => {
    let printDoc: Document;
    let fakeWindow: {
      document: Document;
      focus: jasmine.Spy;
      print: jasmine.Spy;
    };

    beforeEach(() => {
      printDoc = document.implementation.createHTMLDocument('');
      fakeWindow = {
        document: printDoc,
        focus: jasmine.createSpy('focus'),
        print: jasmine.createSpy('print'),
      };
    });

    it('baut ein eigenes Blatt mit Titel, Zeitraum, Code und Hinweis', async () => {
      spyOn(window, 'open').and.returnValue(fakeWindow as unknown as Window);
      fixture.componentRef.setInput('entries', [
        {
          label: 'Spielsekretariat',
          url: 'https://saisonmanager.de/spielsekretariat?code=ABCD2345',
        },
      ]);
      fixture.componentRef.setInput('expiresAt', '2026-10-11T21:59:59Z');
      fixture.componentRef.setInput('code', 'ABCD2345');
      fixture.componentRef.setInput('notice', 'Nur an das Sekretariat.');
      await settle();

      component.print();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(printDoc.querySelector('h1')?.textContent).toBe(
        'Spielsekretariat'
      );
      expect(printDoc.querySelector('.subject')?.textContent).toBe(
        'Sa., 10.10.2026 · Halle Nord'
      );
      expect(printDoc.querySelector('.validity')?.textContent).toContain(
        '11.10.2026, 23:59 Uhr'
      );
      expect(printDoc.querySelector('.code strong')?.textContent).toBe(
        'ABCD-2345'
      );
      expect(printDoc.querySelector('.notice')?.textContent).toBe(
        'Nur an das Sekretariat.'
      );
      expect(printDoc.querySelectorAll('.entry img').length).toBe(1);
      expect(fakeWindow.print).toHaveBeenCalled();
    });

    // Liga- und Hallennamen kommen aus der Datenbank. Als Markup eingesetzt,
    // liefe ein präparierter Name im Druckfenster als Skript.
    it('setzt Namen als Text, nicht als Markup', async () => {
      spyOn(window, 'open').and.returnValue(fakeWindow as unknown as Window);
      fixture.componentRef.setInput(
        'subject',
        '<img src=x onerror="alert(1)">'
      );
      await settle();

      component.print();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(printDoc.querySelector('.subject')?.textContent).toBe(
        '<img src=x onerror="alert(1)">'
      );
      expect(printDoc.querySelectorAll('.subject img').length).toBe(0);
    });

    // Wer gleich nach dem Erzeugen druckt, ist schneller als die QR-Codes.
    // Der Zettel geht an den Spieltisch und braucht den Code trotzdem.
    it('wartet beim Drucken auf die QR-Codes', async () => {
      spyOn(window, 'open').and.returnValue(fakeWindow as unknown as Window);
      fixture.componentRef.setInput('entries', [
        {
          label: 'Spielsekretariat',
          url: 'https://saisonmanager.de/spielsekretariat?code=ABCD2345',
        },
      ]);
      fixture.detectChanges();

      component.print();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(printDoc.querySelectorAll('.entry img').length).toBe(1);
      expect(fakeWindow.print).toHaveBeenCalled();
    });

    it('meldet ein blockiertes Druckfenster', async () => {
      spyOn(window, 'open').and.returnValue(null);
      await settle();

      component.print();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain(
        'Das Druckfenster wurde vom Browser blockiert'
      );
    });
  });
});
