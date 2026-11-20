import { TestBed } from '@angular/core/testing';

import { LostPasswordComponent } from './lost-password.component';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ReactiveFormsModule } from '@angular/forms';

describe('LostPasswordComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        ReactiveFormsModule,
        getTranslocoTestingModule(),
      ],
      declarations: [LostPasswordComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { params: of({ resetToken: 'alter-link' }) },
        },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LostPasswordComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Ein durch eine neuere Mail ersetzter oder abgelaufener Link (404) muss
  // erklären, dass mit ihm nichts geändert wurde und wie man einen neuen Link
  // bekommt. Vorher stand nur ein Toast da, und das Formular lud zu weiteren
  // Versuchen mit demselben toten Link ein. Neutral formuliert, ohne feste
  // Frist: Derselbe Hinweis erscheint auch für einen schon eingelösten Link
  // und für Einladungen, die 14 Tage statt 24 Stunden gelten.
  it('should explain an invalid link instead of offering the form again', () => {
    const fixture = TestBed.createComponent(LostPasswordComponent);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    // Über die Eingabefelder wie im Browser: Ein setValue am Formular markiert
    // die Ansicht nicht als geändert, und die Prüfliste unter dem Feld bindet
    // den Feldwert direkt (sonst NG0100).
    const el: HTMLElement = fixture.nativeElement;
    for (const id of ['new_password', 'password_confirmation']) {
      const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = 'NeuesPasswort1';
      input.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    el.querySelector('form')!.dispatchEvent(new Event('submit'));

    http
      .expectOne((req) => req.url.endsWith('reset_password.json'))
      .flush(
        { success: false, message: 'Ungültiger oder abgelaufener Link.' },
        { status: 404, statusText: 'Not Found' }
      );
    fixture.detectChanges();

    expect(component.linkInvalid).toBeTrue();
    const hint =
      el.querySelector('[data-testid="reset-link-invalid"]')?.textContent ?? '';
    expect(hint).toContain('Mit diesem Link wurde nichts geändert');
    expect(hint).not.toContain('Passwort wurde nicht geändert');
    expect(hint).not.toContain('24 Stunden');
    expect(el.querySelector('form')).toBeNull();
    http.verify();
  });
});
