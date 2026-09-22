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
