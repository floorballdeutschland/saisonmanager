import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, Subject } from 'rxjs';
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

  // Ein Gast trägt keine Lizenznummer. Das Formular belegt das Feld aber mit
  // der nächsten freien Nummer vor und blendet es beim Haken nur aus — der
  // Wert ging trotzdem mit und belegte eine Nummer aus dem laufenden Bestand
  // (api#646).
  describe('Gast-Haken und Lizenznummer', () => {
    function build(): RefereeEditComponent {
      const component =
        TestBed.createComponent(RefereeEditComponent).componentInstance;
      component.referee = { vorname: 'Gast', lizenznummer: 8725 };
      return component;
    }

    it('nimmt die vorbelegte Nummer aus dem Formular', () => {
      const component = build();

      component.setGuest(true);

      expect(component.referee.guest).toBeTrue();
      expect(component.referee.lizenznummer).toBeNull();
    });

    it('legt die Vorbelegung beim Abwählen zurück', () => {
      const component = build();

      component.setGuest(true);
      component.setGuest(false);

      expect(component.referee.guest).toBeFalse();
      expect(component.referee.lizenznummer).toBe(8725);
    });

    // Die Vorbelegung kommt aus einer eigenen Anfrage und kann nach dem Klick
    // eintreffen. Sie darf dem Gast dann keine Nummer mehr unterschieben —
    // gemerkt wird sie trotzdem, sonst stünde das Feld beim Abwählen leer da.
    it('schreibt eine spät eintreffende Vorbelegung nicht in einen Gast', () => {
      const refereeService = TestBed.inject(RefereeService);
      const naechste$ = new Subject<{ next_lizenznummer: number }>();
      spyOn(refereeService, 'adminGetNextLizenznummer').and.returnValue(
        naechste$
      );
      const fixture = TestBed.createComponent(RefereeEditComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component.setGuest(true);
      naechste$.next({ next_lizenznummer: 8725 });

      expect(component.referee.lizenznummer).toBeNull();

      component.setGuest(false);

      expect(component.referee.lizenznummer).toBe(8725);
    });
  });

  // Eine vergebene Lizenznummer bleibt, wie sie ist — das Feld ist im
  // Bearbeiten-Modus gesperrt. Trägt der Datensatz keine (ein Gast, oder
  // einer, dem der Haken sie genommen hat), muss sie eintragbar bleiben:
  // Sonst gäbe es keinen Weg zurück aus dem Gast-Zustand, weil die Nummer für
  // einen Nicht-Gast Pflicht ist.
  describe('Sperre des Nummernfeldes', () => {
    // Der Aufruf läuft über die Route: eine Lizenznummer wird gesucht, ein
    // Gast über seine Ersatzform „G-<id>" direkt geladen.
    function laden(
      param: string,
      referee: Partial<RefereeAdmin>
    ): RefereeEditComponent {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: { snapshot: { params: { lizenznummer: param } } },
      });
      const refereeService = TestBed.inject(RefereeService);
      const geladen = { id: 7, ...referee } as RefereeAdmin;
      spyOn(refereeService, 'adminGetAll').and.returnValue(of([geladen]));
      spyOn(refereeService, 'adminGetById').and.returnValue(of(geladen));
      const fixture = TestBed.createComponent(RefereeEditComponent);
      fixture.detectChanges();
      return fixture.componentInstance;
    }

    it('sperrt die Nummer eines Schiedsrichters, der eine trägt', () => {
      expect(
        laden('8725', { lizenznummer: 8725 }).licenseNumberLocked
      ).toBeTrue();
    });

    it('lässt sie bei einem Gast ohne Nummer eintragbar', () => {
      const component = laden('G-7', { lizenznummer: null, guest: true });

      expect(component.licenseNumberLocked).toBeFalse();

      // Der Rückweg: Haken abwählen, Nummer eintragen, speichern.
      component.setGuest(false);
      expect(component.licenseNumberLocked).toBeFalse();
    });
  });
});
