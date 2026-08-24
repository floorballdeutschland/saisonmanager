import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { TransferRequest } from '@floorball/types';
import { TransferRequestDetailComponent } from './transfer-request-detail.component';

// Vorher zeigte das Protokoll zwei Zeitpunkte, nur bei Freigaben und nur im
// Status genehmigt oder widerrufen; wer gehandelt hat, stand nirgends. Damit
// war nach Abschluss eines Vorgangs nicht mehr zu klären, wer ihn veranlasst
// hat.
describe('TransferRequestDetailComponent – Chronik', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        // Mit echten Strings, weil der Rückfall auf die Konto-ID die
        // Interpolation braucht; ohne sie gibt Transloco nur den Schlüssel
        // zurück und der Test wäre tautologisch.
        getTranslocoTestingModule({
          de: {
            transferRequestAdmin: {
              detail: {
                protocolUnknownActor: 'Konto {{ id }} (nicht mehr vorhanden)',
              },
            },
          },
        }),
      ],
      declarations: [TransferRequestDetailComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  function componentWith(
    request: Partial<TransferRequest>
  ): TransferRequestDetailComponent {
    const component = TestBed.createComponent(TransferRequestDetailComponent)
      .componentInstance;
    component.request = {
      id: 1,
      status: 'pending_club',
      request_type: 'transfer',
      season_id: 18,
      created_at: '2026-08-01T10:00:00.000Z',
      player: { id: 1, first_name: 'Max', last_name: 'Muster', birthdate: '1995-03-15' },
      requesting_club: { id: 2, name: 'Aufnehmend' },
      former_club: { id: 3, name: 'Abgebend' },
      ...request,
    } as TransferRequest;
    return component;
  }

  it('führt jeden Schritt mit Zeitpunkt und handelndem Konto', () => {
    const component = componentWith({
      status: 'approved',
      created_by: 7,
      created_by_name: 'Anna Antrag (aa)',
      club_approved_at: '2026-08-02T10:00:00.000Z',
      approved_by_club_user_id: 8,
      approved_by_club_user_name: 'Bernd Verein (bv)',
      lv_approved_at: '2026-08-03T10:00:00.000Z',
      approved_by_lv_user_id: 9,
      approved_by_lv_user_name: 'Judith Verband (jv)',
    });

    const steps = component.protocolSteps;
    expect(steps.map((s) => s.key)).toEqual([
      'submitted',
      'clubApproved',
      'lvApproved',
    ]);
    expect(steps[0].actorName).toBe('Anna Antrag (aa)');
    expect(steps[1].actorName).toBe('Bernd Verein (bv)');
    expect(steps[2].actorName).toBe('Judith Verband (jv)');
  });

  // Ein Schritt hängt allein an seinem Zeitpunkt. So bleibt die Chronik ohne
  // weitere Statusabfragen richtig, auch für Vorgänge, die noch laufen.
  it('lässt Schritte ohne Zeitpunkt weg', () => {
    const component = componentWith({ created_by_name: 'Anna Antrag (aa)' });

    expect(component.protocolSteps.map((s) => s.key)).toEqual(['submitted']);
  });

  it('benennt die Freigabe eines Antragstyps release eigens', () => {
    const component = componentWith({
      request_type: 'release',
      status: 'approved',
      lv_approved_at: '2026-08-03T10:00:00.000Z',
    });

    expect(component.protocolSteps.map((s) => s.key)).toEqual([
      'submitted',
      'releaseGranted',
    ]);
  });

  // Ablehnung durch Verein und Verband schreiben in dieselben Felder; welcher
  // Weg es war, sagt allein der Status.
  it('unterscheidet die Ablehnung nach Status', () => {
    const byClub = componentWith({
      status: 'rejected_by_club',
      rejected_at: '2026-08-02T10:00:00.000Z',
      rejection_reason: 'Beitrag offen',
    });
    expect(byClub.protocolSteps.map((s) => s.key)).toContain('rejectedByClub');
    expect(
      byClub.protocolSteps.find((s) => s.kind === 'rejected')?.note
    ).toBe('Beitrag offen');

    const byLv = componentWith({
      status: 'rejected_by_lv',
      rejected_at: '2026-08-02T10:00:00.000Z',
    });
    expect(byLv.protocolSteps.map((s) => s.key)).toContain('rejectedByLv');
  });

  it('führt den Abbruch eines Vorgangs mit Konto', () => {
    const component = componentWith({
      status: 'withdrawn',
      withdrawn_at: '2026-08-02T10:00:00.000Z',
      withdrawn_by: 4,
      withdrawn_by_name: 'Carla Abbruch (ca)',
    });

    const step = component.protocolSteps.find((s) => s.key === 'withdrawn');
    expect(step?.kind).toBe('rejected');
    expect(step?.actorName).toBe('Carla Abbruch (ca)');
  });

  // Die Bestätigung läuft über den Link in der Mail, ohne Anmeldung. Es gibt
  // dort kein handelndes Konto, nur den Zeitpunkt.
  it('führt die Bestätigung der Person ohne Konto', () => {
    const component = componentWith({
      player_approved_at: '2026-08-02T10:00:00.000Z',
    });

    const step = component.protocolSteps.find(
      (s) => s.key === 'playerApproved'
    );
    expect(step).toBeDefined();
    expect(component.actorLabel(step!)).toBeNull();
  });

  describe('Anzeige des handelnden Kontos', () => {
    it('nimmt den Namen, wenn er vorliegt', () => {
      const component = componentWith({});

      expect(
        component.actorLabel({
          key: 'submitted',
          kind: 'done',
          actorId: 7,
          actorName: 'Anna Antrag (aa)',
        })
      ).toBe('Anna Antrag (aa)');
    });

    // Ohne Namen bleibt die ID die belastbare Angabe – etwa wenn das Konto
    // gelöscht wurde oder die eigene Rolle keine Namen sieht.
    it('fällt ohne Namen auf die ID zurück', () => {
      const component = componentWith({});

      expect(
        component.actorLabel({ key: 'submitted', kind: 'done', actorId: 7 })
      ).toContain('7');
    });

    // Ohne beides steht dort nichts, statt eine leere Klammer zu zeigen.
    it('liefert ohne Konto null', () => {
      const component = componentWith({});

      expect(
        component.actorLabel({ key: 'submitted', kind: 'done' })
      ).toBeNull();
    });
  });
});
