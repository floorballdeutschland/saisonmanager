import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';

import { SessionService, getTranslocoTestingModule } from '@floorball/core';
import { User } from '@floorball/types';
import { environment } from 'src/environments/environment';

import { TabletHighlightRequestComponent } from './tablet-highlight-request.component';

const API = environment.apiURL;
const PATH = API + 'games/4711/highlight_request.json';

describe('TabletHighlightRequestComponent', () => {
  let fixture: ComponentFixture<TabletHighlightRequestComponent>;
  let component: TabletHighlightRequestComponent;
  let http: HttpTestingController;
  let user: Partial<User> | null;

  beforeEach(async () => {
    user = null;
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        FormsModule,
        getTranslocoTestingModule(),
      ],
      declarations: [TabletHighlightRequestComponent],
      providers: [
        {
          provide: SessionService,
          useValue: {
            get currentUserValue() {
              return user;
            },
          },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TabletHighlightRequestComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('gameId', 4711);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function query(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  function open() {
    query('tablet-highlight-request-toggle')!.click();
    fixture.detectChanges();
  }

  describe('angemeldet', () => {
    beforeEach(() => {
      user = { email: 'tm@verein.de' };
    });

    it('schickt ohne Adresse, die Mail geht an das Konto', () => {
      open();
      expect(query('tablet-highlight-request-account')!.textContent).toContain(
        'tablet.highlightRequest.toAccount'
      );
      expect(query('tablet-highlight-request-email')).toBeNull();

      component.send();

      const req = http.expectOne(PATH);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: null });
      req.flush(null, { status: 202, statusText: 'Accepted' });
      fixture.detectChanges();

      expect(query('tablet-highlight-request-sent')).not.toBeNull();
      expect(component.open).toBeFalse();
    });

    it('nimmt auf Wunsch eine andere Adresse', async () => {
      open();
      // NgForm meldet seine Felder erst nach einem Mikrotask an.
      await fixture.whenStable();
      query('tablet-highlight-request-other')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      const input = query('tablet-highlight-request-email') as HTMLInputElement;
      expect(input).not.toBeNull();
      input.value = 'anders@example.de';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      component.send();

      expect(http.expectOne(PATH).request.body).toEqual({
        email: 'anders@example.de',
      });
    });
  });

  describe('mit dem Sekretariats-Link', () => {
    it('verlangt eine Adresse', () => {
      open();
      expect(query('tablet-highlight-request-account')).toBeNull();
      expect(query('tablet-highlight-request-email')).not.toBeNull();
      expect(component.canSend).toBeFalse();

      component.email = 'kein-at';
      expect(component.canSend).toBeFalse();
      component.send();
      http.expectNone(PATH);

      component.email = ' sekretariat@example.de ';
      expect(component.canSend).toBeTrue();
      component.send();
      expect(http.expectOne(PATH).request.body).toEqual({
        email: 'sekretariat@example.de',
      });
    });
  });

  it('meldet eine Absage mit 403 selbst', () => {
    user = { email: 'tm@verein.de' };
    open();
    component.send();
    http
      .expectOne(PATH)
      .flush({ message: 'nein' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(query('tablet-highlight-request-error')).not.toBeNull();
    expect(component.sent).toBeFalse();
  });

  it('setzt sich beim Wechsel des Spiels zurück', () => {
    user = { email: 'tm@verein.de' };
    open();
    component.send();
    http.expectOne(PATH).flush(null, { status: 202, statusText: 'Accepted' });
    expect(component.sent).toBeTrue();

    fixture.componentRef.setInput('gameId', 4712);
    fixture.detectChanges();

    expect(component.sent).toBeFalse();
  });
});
