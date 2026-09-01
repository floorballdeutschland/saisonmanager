import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import {
  getTranslocoTestingModule,
  NotificationService,
  RefereeService,
} from '@floorball/core';
import { Club, RefereeAdmin } from '@floorball/models';

import { RefereeEditComponent } from './referee-edit.component';

describe('RefereeEditComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        getTranslocoTestingModule(),
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      declarations: [RefereeEditComponent],
    })
      .overrideTemplate(RefereeEditComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(RefereeEditComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // api#585: Die Gültigkeit einer Zusatzqualifikation ist Pflichtfeld. Das
  // `required` am Datumsfeld hält das Absenden nicht auf (Angular setzt
  // `novalidate` auf das Formular), der Riegel sitzt deshalb in submit().
  describe('Pflichtfeld Gültigkeit der Zusatzqualifikation', () => {
    let refereeService: RefereeService;
    let notificationService: NotificationService;

    function build(): RefereeEditComponent {
      const component =
        TestBed.createComponent(RefereeEditComponent).componentInstance;
      refereeService = TestBed.inject(RefereeService);
      notificationService = TestBed.inject(NotificationService);
      spyOn(refereeService, 'adminUpdate').and.returnValue(
        of({ id: 7, lizenznummer: 1234 } as RefereeAdmin)
      );
      spyOn(notificationService, 'error');
      spyOn(notificationService, 'success');
      component.editMode = true;
      component.referee = {
        id: 7,
        vorname: 'Anna',
        nachname: 'Schiri',
        lizenznummer: 1234,
      };
      return component;
    }

    it('speichert nicht, wenn eine Zusatzqualifikation kein Ablaufdatum hat', () => {
      const component = build();
      component.qualifications = [
        { qualification_type_id: 3, valid_until: '2027-06-30' },
        { qualification_type_id: 4 },
      ];

      component.submit();

      expect(refereeService.adminUpdate).not.toHaveBeenCalled();
      expect(notificationService.error).toHaveBeenCalled();
    });

    it('speichert, wenn jede Zusatzqualifikation ein Ablaufdatum hat', () => {
      const component = build();
      component.qualifications = [
        { qualification_type_id: 3, valid_until: '2027-06-30' },
      ];

      component.submit();

      expect(refereeService.adminUpdate).toHaveBeenCalled();
      expect(notificationService.error).not.toHaveBeenCalled();
    });

    // Bei eingeschränkter Bearbeitung beachtet die Schnittstelle die
    // mitgeschickten Qualifikationen gar nicht. Ein Altbestand ohne Datum darf
    // diesen Nutzern deshalb nicht die Felder sperren, die sie pflegen dürfen.
    it('hält die eingeschränkte Bearbeitung nicht auf', () => {
      const component = build();
      component.isRestricted = true;
      component.qualifications = [{ qualification_type_id: 4 }];

      component.submit();

      expect(refereeService.adminUpdate).toHaveBeenCalled();
      expect(notificationService.error).not.toHaveBeenCalled();
    });
  });

  // fe#318: Das Feld „Verein" weist zu, `clubs` benennt daneben aber auch den
  // bereits eingetragenen Verein — fb-select-search liest sein Label aus
  // `items`. Eingegrenzt wird deshalb nur die Auswahl.
  describe('selectableClubs', () => {
    function build(clubId?: number): RefereeEditComponent {
      const component =
        TestBed.createComponent(RefereeEditComponent).componentInstance;
      component.clubs = [
        { id: 1, name: 'Aktiv' } as Club,
        { id: 2, name: 'Deaktiviert', deactivated: true } as Club,
      ];
      component.referee = { club_id: clubId };
      return component;
    }

    it('bietet keine deaktivierten Vereine zur Auswahl an', () => {
      expect(build().selectableClubs.map((c) => c.id)).toEqual([1]);
    });

    it('behält den bereits eingetragenen Verein in der Liste', () => {
      expect(build(2).selectableClubs.map((c) => c.id)).toEqual([1, 2]);
    });

    // fb-select-search wertet jede neue Referenz in ngOnChanges aus; bei
    // unveränderter Auswahl muss dieselbe Liste zurückkommen.
    it('liefert bei unveränderter Auswahl dieselbe Referenz', () => {
      const component = build();

      expect(component.selectableClubs).toBe(component.selectableClubs);
    });
  });
});
