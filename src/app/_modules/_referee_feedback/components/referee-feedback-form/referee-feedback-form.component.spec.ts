import { TestBed } from '@angular/core/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { RefereeFeedbackSharedModule } from '../../referee-feedback-shared.module';
import { RefereeFeedbackFormComponent } from './referee-feedback-form.component';

/**
 * Der Fragebogen wird von zwei Modulen genutzt (angemeldete Team-Übersicht und
 * öffentliche Einmal-Link-Seite), der Transloco-Scope hängt deshalb am
 * RefereeFeedbackSharedModule, das ihn deklariert.
 *
 * Der Test hält genau das fest: Die Übersetzungen müssen sich allein über das
 * geteilte Modul auflösen. Läge der Scope am aufrufenden Modul, zeigte der
 * jeweils andere Abgabeweg die rohen Keys, und das fiele erst am Server auf.
 */
describe('RefereeFeedbackFormComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RefereeFeedbackSharedModule,
        getTranslocoTestingModule({
          'referee-feedback/de': {
            form: {
              lineQuestion: 'Frage zur Linie',
              submit: 'Absenden',
            },
          },
        }),
      ],
    }).compileComponents();
  });

  it('löst die Fragen über den Scope des geteilten Moduls auf', () => {
    const fixture = TestBed.createComponent(RefereeFeedbackFormComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Frage zur Linie');
    expect(text).not.toContain('refereeFeedback.form.lineQuestion');
  });

  it('sendet erst, wenn beide Bewertungen gesetzt sind', () => {
    const fixture = TestBed.createComponent(RefereeFeedbackFormComponent);
    const component = fixture.componentInstance;
    const emitted: unknown[] = [];
    component.submitted.subscribe((answers) => emitted.push(answers));

    component.submit();
    expect(emitted.length).toBe(0);

    component.lineRating = 7;
    component.communicationRating = 9;
    component.submit();

    expect(emitted).toEqual([
      {
        line_rating: 7,
        line_comment: undefined,
        communication_rating: 9,
        communication_comment: undefined,
        general_comment: undefined,
      },
    ]);
  });
});
