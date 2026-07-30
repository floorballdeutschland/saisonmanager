import { ChangeDetectorRef } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { NotificationService, RefereeFeedbackService } from '@floorball/core';
import { RefereeFeedbackGame } from '@floorball/types';
import { RefereeFeedbackComponent } from './referee-feedback.component';

/**
 * Die 24-Stunden-Sperre nach dem Spiel erzwingt die API. Die Übersicht listet ein
 * noch gesperrtes Spiel aber bereits und muss es als „Möglich ab" ausweisen statt
 * mit Abgabe-Knopf, sonst läuft die Abgabe in eine Fehlermeldung.
 *
 * Wichtig ist die Gegenrichtung: Ohne verwertbaren Zeitpunkt darf das Spiel nicht
 * als gesperrt gelten, sonst wäre ein Altspiel ohne gepflegtes Datum dauerhaft
 * nicht ausfüllbar.
 *
 * Direkt instanziiert statt über TestBed, weil ausschließlich diese Logik geprüft
 * wird und das Template dafür nichts beiträgt.
 */
describe('RefereeFeedbackComponent', () => {
  let component: RefereeFeedbackComponent;

  beforeEach(() => {
    component = new RefereeFeedbackComponent(
      {} as unknown as RefereeFeedbackService,
      {} as unknown as NotificationService,
      {} as unknown as TranslocoService,
      { markForCheck: () => undefined } as unknown as ChangeDetectorRef,
      'de-DE'
    );
  });

  function gameWith(fillableFrom: string | null): RefereeFeedbackGame {
    return {
      game_id: 1,
      team_id: 2,
      team_name: 'Heim',
      home: true,
      date: '2026-07-28',
      referees: [],
      fillable_from: fillableFrom,
      done: false,
    };
  }

  it('sperrt ein Spiel, dessen Frist noch laeuft', () => {
    const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    expect(component.notYetFillable(gameWith(inTwoHours))).toBe(true);
  });

  it('gibt ein Spiel frei, dessen Frist abgelaufen ist', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    expect(component.notYetFillable(gameWith(twoHoursAgo))).toBe(false);
  });

  it('sperrt nicht ohne Zeitpunkt', () => {
    expect(component.notYetFillable(gameWith(null))).toBe(false);
    expect(component.notYetFillable(gameWith(''))).toBe(false);
    expect(component.notYetFillable(gameWith('kein Zeitpunkt'))).toBe(false);
  });

  it('formatiert einen fehlenden Zeitpunkt als leeren Text', () => {
    expect(component.formatDateTime(null)).toBe('');
  });
});
