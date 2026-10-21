import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';

import { getTranslocoTestingModule } from '@floorball/core';
import { environment } from 'src/environments/environment';

import {
  TABLET_FEEDBACK_MAX_LENGTH,
  TabletFeedbackComponent,
} from './tablet-feedback.component';

const API = environment.apiURL;

describe('TabletFeedbackComponent', () => {
  let fixture: ComponentFixture<TabletFeedbackComponent>;
  let component: TabletFeedbackComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        FormsModule,
        getTranslocoTestingModule(),
      ],
      declarations: [TabletFeedbackComponent],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TabletFeedbackComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('gameId', 4711);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function query(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  it('ist eingeklappt und öffnet das Formular per Knopf', () => {
    expect(query('tablet-feedback-message')).toBeNull();

    query('tablet-feedback-toggle')!.click();
    fixture.detectChanges();

    expect(query('tablet-feedback-message')).not.toBeNull();
  });

  it('schickt Freitext, Antwortadresse und Gerät an das Spiel und dankt', () => {
    component.toggle();
    component.message = '  Knöpfe zu klein  ';
    component.replyTo = 'erfasser@example.de';
    component.send();

    const req = http.expectOne(API + 'games/4711/tablet_feedback.json');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.message).toBe('Knöpfe zu klein');
    expect(req.request.body.reply_to).toBe('erfasser@example.de');
    expect(req.request.body.device).toContain('x');
    req.flush(null, { status: 202, statusText: 'Accepted' });
    fixture.detectChanges();

    expect(query('tablet-feedback-sent')).not.toBeNull();
    expect(component.open).toBeFalse();
    expect(component.message).toBe('');
  });

  it('ohne Antwortadresse schickt es null', () => {
    component.message = 'Lief gut';
    component.send();

    const req = http.expectOne(API + 'games/4711/tablet_feedback.json');
    expect(req.request.body.reply_to).toBeNull();
    req.flush(null, { status: 202, statusText: 'Accepted' });
  });

  it('sendet nicht bei leerem, zu langem Text oder ungültiger Adresse', () => {
    component.message = '   ';
    expect(component.canSend).toBeFalse();

    component.message = 'x'.repeat(TABLET_FEEDBACK_MAX_LENGTH + 1);
    expect(component.canSend).toBeFalse();

    component.message = 'ok';
    component.replyTo = 'keine-adresse';
    expect(component.canSend).toBeFalse();

    component.send();
    http.expectNone(API + 'games/4711/tablet_feedback.json');
  });

  it('zeigt einen Fehler und behält den Text', () => {
    component.toggle();
    component.message = 'Knöpfe zu klein';
    component.send();

    http
      .expectOne(API + 'games/4711/tablet_feedback.json')
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(query('tablet-feedback-error')).not.toBeNull();
    expect(component.message).toBe('Knöpfe zu klein');
  });

  it('setzt sich beim Spielwechsel zurück und verwirft die alte Antwort', () => {
    component.toggle();
    component.message = 'Knöpfe zu klein';
    component.send();
    const req = http.expectOne(API + 'games/4711/tablet_feedback.json');

    fixture.componentRef.setInput('gameId', 4712);
    fixture.detectChanges();
    req.flush(null, { status: 202, statusText: 'Accepted' });

    expect(component.open).toBeFalse();
    expect(component.sent).toBeFalse();
    expect(component.message).toBe('');
  });
});
