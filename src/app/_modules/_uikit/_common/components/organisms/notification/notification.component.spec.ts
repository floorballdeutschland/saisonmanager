import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NotificationService } from '@floorball/core';

import { NotificationComponent } from './notification.component';

// Die Meldungsleiste räumte bisher nur beim Routenwechsel auf. Eine Meldung,
// die ein späteres Ereignis überholt (der Verbindungshinweis, sobald wieder
// eine Antwort ankommt), braucht deshalb einen eigenen Weg hinaus, der die
// übrigen Meldungen stehen lässt.
describe('NotificationComponent', () => {
  let component: NotificationComponent;
  let fixture: ComponentFixture<NotificationComponent>;
  let service: NotificationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NotificationComponent],
      imports: [RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(NotificationService);
    fixture.detectChanges();
  });

  // Der Fehlerbericht aus fe#489: Die Spielansicht laedt drei Abrufe je Takt,
  // ein Aussetzer legte also drei deckungsgleiche Baender uebereinander, die
  // einzeln weggeklickt werden mussten.
  it('shows the same standing message only once', () => {
    service.error('Keine Verbindung zum Server.');
    service.error('Keine Verbindung zum Server.');
    service.error('Keine Verbindung zum Server.');

    expect(component.notifications.length).toBe(1);
  });

  // Die Wache darf nicht zum Maulkorb werden: Wer das Band wegklickt und
  // danach erneut in einen Fehler laeuft, muss ihn wieder sehen. Genau das
  // ging schief, solange der Interceptor sich selbst gemerkt hat, ob die
  // Meldung steht.
  it('shows the message again after it was closed', () => {
    // Ohne `fade` faellt das Ausblenden mit seinem Zeitgeber weg, das Entfernen
    // wirkt also sofort.
    component.fade = false;

    service.error('Keine Verbindung zum Server.');
    component.removeNotification(component.notifications[0]);
    expect(component.notifications.length).toBe(0);

    service.error('Keine Verbindung zum Server.');

    expect(component.notifications.length).toBe(1);
  });

  // Meldungen, die sich nach drei Sekunden selbst abraeumen, sind eine
  // Rueckmeldung auf eine Handlung. Zweimal gespeichert heisst zweimal
  // bestaetigt.
  it('keeps stacking messages that close by themselves', () => {
    service.success('Gespeichert.', { autoClose: true });
    service.success('Gespeichert.', { autoClose: true });

    expect(component.notifications.length).toBe(2);
  });

  it('removes only the notifications with that text', () => {
    service.error('Keine Verbindung zum Server.');
    service.error('Bitte ein Datum wählen.');

    service.dismiss('Keine Verbindung zum Server.');

    expect(component.notifications.map((n) => n.message)).toEqual([
      'Bitte ein Datum wählen.',
    ]);
  });

  it('keeps the stack when the text is not on it', () => {
    service.error('Bitte ein Datum wählen.');

    service.dismiss('Keine Verbindung zum Server.');

    expect(component.notifications.length).toBe(1);
  });

  // Die bestehende Bedeutung einer Meldung ohne Text bleibt unberührt: Sie
  // räumt den Stapel bis auf die Einträge, die den Routenwechsel überleben
  // sollen.
  it('still clears the stack for an empty notification', () => {
    service.error('Bitte ein Datum wählen.');
    service.error('Nicht gefunden.', { keepAfterRouteChange: true });

    service.clear();

    expect(component.notifications.map((n) => n.message)).toEqual([
      'Nicht gefunden.',
    ]);
  });
});
