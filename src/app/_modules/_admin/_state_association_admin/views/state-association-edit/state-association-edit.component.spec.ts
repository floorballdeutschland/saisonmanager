import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import {
  getTranslocoTestingModule,
  NotificationService,
  SessionService,
  StateAssociationService,
} from '@floorball/core';
import { StateAssociation, User } from '@floorball/types';
import {
  INHERITED_SETTINGS,
  StateAssociationEditComponent,
} from './state-association-edit.component';

// Untergeordneter Landesverband, wie ihn der Detail-Endpunkt liefert: eigene
// Postfächer leer, die geerbten Werte als effective_* daneben.
//
// Die eigenen Einstellungen weichen bewusst von den geerbten ab. Das ist der
// Bestand, den ein Kind-LV nach dem Anhängen eines Verbunds behält: gespeichert
// bleibt er stehen, gelesen wird er nirgends mehr. Die Maske darf ihn deshalb
// weder anzeigen noch zurückschreiben.
const KIND_LV: StateAssociation = {
  id: 2,
  name: 'Kind-LV',
  short_name: 'KLV',
  parent_id: 1,
  parent_name: 'Verbund Ost',
  vsk_email: null,
  sbk_email: null,
  rsk_email: null,
  express_license_enabled: true,
  scan_required: true,
  referee_license_review_enabled: false,
  referee_assignment_external_enabled: false,
  referee_assignment_enabled: false,
  person_level_assignment_default: false,
  report_form_email_enabled: false,
  manual_proceeding_creation: false,
  effective_referee_license_review_enabled: true,
  effective_express_license_enabled: false,
  effective_scan_required: false,
  effective_referee_assignment_external_enabled: true,
  effective_referee_assignment_enabled: true,
  effective_person_level_assignment_default: true,
  effective_report_form_email_enabled: true,
  effective_manual_proceeding_creation: true,
  effective_requested_license_playable: true,
  effective_vsk_email: 'vsk@verbund.example.com',
  effective_sbk_email: 'sbk@verbund.example.com',
  effective_rsk_email: null,
  // Zuständigkeitsbereich: Sachsen-Anhalt selbst, Sachsen kommt über einen
  // untergeordneten Verband dazu. Die Vererbung läuft hier nach unten, deshalb
  // steht in effective_states mehr als in states. Die Kinder stehen als
  // short_hash in `children`, also ohne ihre eigenen `states` — genau deshalb
  // wird der geerbte Rest aus effective_states gerechnet.
  states: ['de-st'],
  effective_states: ['de-sn', 'de-st'],
  children: [{ id: 3, name: 'Enkel-LV', short_name: 'ELV' }],
  checklist_items: [],
  releases: [],
};

describe('StateAssociationEditComponent', () => {
  let service: jasmine.SpyObj<StateAssociationService>;

  const createComponent = () => {
    const fixture = TestBed.createComponent(StateAssociationEditComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj<StateAssociationService>(
      'StateAssociationService',
      ['adminGetAll', 'adminGet', 'adminGetReleaseCandidates', 'adminUpdate']
    );
    // Bewusst leer: Ein regionaler SBK bekommt über adminGetAll nur die eigenen
    // Landesverbände, den übergeordneten Verbund nicht. Name und geerbte Werte
    // dürfen davon nicht abhängen.
    service.adminGetAll.and.returnValue(of([]));
    service.adminGet.and.returnValue(of(KIND_LV));
    service.adminGetReleaseCandidates.and.returnValue(of([]));
    service.adminUpdate.and.returnValue(of(KIND_LV));

    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [StateAssociationEditComponent],
      providers: [
        { provide: StateAssociationService, useValue: service },
        {
          provide: SessionService,
          useValue: { currentUser$: of(null) } as unknown as SessionService,
        },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj<NotificationService>(
            'NotificationService',
            ['success', 'error']
          ),
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { id: '2' } } },
        },
      ],
    })
      .overrideTemplate(StateAssociationEditComponent, '')
      .compileComponents();
  });

  // Der Abschnitt „Spielbetrieb" haengt an einem eigenen, engeren Recht als die
  // Maske selbst: Der globale SBK darf den Verband pflegen, aber am Spielbetrieb
  // haengen zwei Felder, die Rechte verschieben. Die API antwortet ihm mit 403,
  // und der ErrorInterceptor wuerde ihn aus dieser Maske werfen -- der Abschnitt
  // darf ihm deshalb nicht einmal angezeigt werden.
  it('zeigt den Spielbetriebs-Abschnitt nur bundesweiten Admins', () => {
    const component = createComponent();

    expect(component.canManageGameOperation).toBeFalse();

    component.currentUser = {
      permissions: { menu_item_state_association_sbk: true },
    } as unknown as User;
    expect(component.canManageGameOperation).toBeFalse();

    component.currentUser = {
      permissions: { menu_item_game_operation_admin: true },
    } as unknown as User;
    expect(component.canManageGameOperation).toBeTrue();
  });

  it('nennt den Verbund aus dem Detail-Datensatz, nicht aus der Liste', () => {
    expect(createComponent().stateAssociation.parent_name).toBe('Verbund Ost');
  });

  it('zeigt den geerbten Wert nur fuer den gespeicherten Verbund', () => {
    const component = createComponent();

    expect(component.showInheritedValues).toBeTrue();
    expect(component.inheritedPending).toBeFalse();
    expect(component.mailboxPlaceholder('sbk')).toBe('sbk@verbund.example.com');

    // Auswahl umgestellt, aber noch nicht gespeichert: die effective_*-Werte
    // gehören noch zum alten Verbund und dürfen nicht angezeigt werden.
    component.stateAssociation.parent_id = 99;

    expect(component.showInheritedValues).toBeFalse();
    expect(component.inheritedPending).toBeTrue();
    expect(component.mailboxPlaceholder('sbk')).toBe('');
  });

  it('zeigt bei einem Kind-LV die Einstellungen des Verbunds', () => {
    const component = createComponent();

    // Nicht der eigene (stehengebliebene) Stand, sondern der geerbte: Der ist
    // der einzige, den das Backend noch liest.
    expect(component.setting('scan_required')).toBeFalse();
    expect(component.setting('express_license_enabled')).toBeFalse();
    expect(component.setting('referee_license_review_enabled')).toBeTrue();
    expect(component.setting('report_form_email_enabled')).toBeTrue();
    expect(component.setting('manual_proceeding_creation')).toBeTrue();
    expect(component.setting('requested_license_playable')).toBeTrue();
    // Die drei gestaffelten Ansetzungs-Optionen ebenso.
    expect(component.refereeAssignmentExternal).toBeTrue();
    expect(component.refereeAssignmentPersonLevel).toBeTrue();
    expect(component.personLevelAssignmentDefault).toBeTrue();
  });

  it('zeigt den eigenen Stand, solange der Verbund nicht gespeichert ist', () => {
    const component = createComponent();
    component.stateAssociation.parent_id = 99;

    // Die effective_*-Werte gehören noch zum alten Verbund. Bis zum Speichern
    // bleibt deshalb der eigene Stand stehen, dazu der Hinweis im Template.
    expect(component.inheritedPending).toBeTrue();
    expect(component.setting('scan_required')).toBeTrue();
    expect(component.setting('report_form_email_enabled')).toBeFalse();
  });

  it('sendet die Einstellungen eines Kind-LV gar nicht mit', () => {
    const component = createComponent();

    component.submit();

    const payload = service.adminUpdate.calls.mostRecent()
      .args[1] as StateAssociation;
    // Nicht mitsenden statt auf false zwingen: Der gespeicherte Stand bleibt
    // unangetastet und steht wieder zur Verfügung, wenn der Verbund gelöst wird.
    expect('scan_required' in payload).toBeFalse();
    expect('express_license_enabled' in payload).toBeFalse();
    expect('referee_license_review_enabled' in payload).toBeFalse();
    expect('referee_assignment_external_enabled' in payload).toBeFalse();
    expect('report_form_email_enabled' in payload).toBeFalse();
    expect('manual_proceeding_creation' in payload).toBeFalse();
    expect('requested_license_playable' in payload).toBeFalse();
    // Stammdaten und Postfächer gehen weiter mit; die Postfächer erben anders
    // (ein eigener Eintrag gewänne), am Kind-LV steht bewusst keiner.
    expect(payload.name).toBe('Kind-LV');
    expect(payload.vsk_email).toBeNull();
    expect(payload.sbk_email).toBeNull();
  });

  it('uebernimmt beim Loesen des Verbunds die bis dahin geltenden Werte', () => {
    const component = createComponent();

    component.stateAssociation.parent_id = null;
    component.onParentChanged();
    component.submit();

    const payload = service.adminUpdate.calls.mostRecent()
      .args[1] as StateAssociation;
    // Nicht der eigene (nie gepflegte) Stand: Sonst schaltete das Lösen des
    // Verbunds in derselben Speicherung den Berichtsworkflow und den
    // Ansetzungsweg ab, ohne dass irgendwo etwas davon steht.
    expect(payload.report_form_email_enabled).toBeTrue();
    expect(payload.manual_proceeding_creation).toBeTrue();
    expect(payload.referee_assignment_external_enabled).toBeTrue();
    expect(payload.referee_assignment_enabled).toBeTrue();
    expect(payload.person_level_assignment_default).toBeTrue();
    // Und umgekehrt: der eigene Haken am Kind-LV setzt sich nicht durch, wenn
    // der Verbund die Einstellung aus hatte.
    expect(payload.scan_required).toBeFalse();
    expect(payload.express_license_enabled).toBeFalse();
  });

  it('greift auch, wenn das Dropdown den Wechsel nicht meldet', () => {
    const component = createComponent();

    // Ohne den Aufruf von onParentChanged: submit() holt es nach.
    component.stateAssociation.parent_id = null;
    component.submit();

    const payload = service.adminUpdate.calls.mostRecent()
      .args[1] as StateAssociation;
    expect(payload.report_form_email_enabled).toBeTrue();
  });

  it('sendet die Einstellungen ohne Verbund weiterhin mit', () => {
    const component = createComponent();
    // Ein Verband, der nie einen Verbund hatte: kein Loesen, keine Uebernahme.
    component.stateAssociation.parent_id = null;
    component['_persistedParentId'] = null;
    component.setSetting('scan_required', true);
    component.setSetting('requested_license_playable', true);
    component.refereeAssignmentExternal = true;
    component.refereeAssignmentPersonLevel = true;

    component.submit();

    const payload = service.adminUpdate.calls.mostRecent()
      .args[1] as StateAssociation;
    expect(payload.scan_required).toBeTrue();
    expect(payload.referee_assignment_external_enabled).toBeTrue();
    expect(payload.referee_assignment_enabled).toBeTrue();
    // Die Staffelung steht schon im Payload: Die Voreinstellung ist nicht
    // gesetzt, obwohl die Personenebene an ist.
    expect(payload.person_level_assignment_default).toBeFalse();
    // Der neue Schalter ebenso: Er stand in INHERITED_SETTINGS und in der
    // Maske, fehlte aber im handgeschriebenen Payload-Block — die Checkbox
    // liess sich anhaken und der Wert verschwand beim Speichern spurlos.
    expect(payload.requested_license_playable).toBeTrue();
  });

  // Strukturell und nicht Feld fuer Feld: Die naechste Einstellung, die jemand
  // in INHERITED_SETTINGS eintraegt, aber im Payload vergisst, faellt hier auf.
  // Der negative Test weiter oben (Kind-LV sendet nichts mit) kann das nicht
  // leisten — ein Schluessel, der nirgends geschrieben wird, besteht ihn.
  it('sendet ohne Verbund JEDE Einstellung aus INHERITED_SETTINGS mit', () => {
    const component = createComponent();
    component.stateAssociation.parent_id = null;
    component['_persistedParentId'] = null;

    component.submit();

    const payload = service.adminUpdate.calls.mostRecent()
      .args[1] as StateAssociation;
    INHERITED_SETTINGS.forEach((key) => {
      expect(key in payload)
        .withContext(`${key} fehlt im Payload`)
        .toBeTrue();
    });
  });

  it('trennt eigene und geerbte Bundeslaender', () => {
    const component = createComponent();

    expect(component.isStateSelected('de-st')).toBeTrue();
    // Sachsen kommt über einen untergeordneten Verband und steht deshalb nicht
    // als eigene Auswahl da, sondern als Hinweis.
    expect(component.isStateSelected('de-sn')).toBeFalse();
    expect(component.inheritedStates).toEqual(['de-sn']);
    expect(component.inheritedStateNames).toBe('Sachsen');
  });

  it('zaehlt ein abgewaehltes eigenes Bundesland nicht als geerbt', () => {
    // effective_states ist ein Serverwert zum gespeicherten Stand, die Auswahl
    // im Formular läuft ihm voraus. Ohne den gemerkten Stand rutschte das
    // gerade abgewählte Sachsen-Anhalt in die geerbten, und die Maske
    // behauptete, es käme über einen untergeordneten Verband.
    const component = createComponent();

    component.toggleState('de-st');

    expect(component.inheritedStates).toEqual(['de-sn']);
    expect(component.inheritedStateNames).toBe('Sachsen');
  });

  it('meldet einen Speicherfehler nicht selbst', () => {
    // Das übernimmt der ErrorInterceptor für jeden Status. Ein zweiter Toast
    // wäre eine Dublette, und weil beide nicht selbst schließen und ein
    // Fehlschlag nicht navigiert, stapeln sie sich mit jedem Versuch (#228).
    const notification = TestBed.inject(
      NotificationService
    ) as jasmine.SpyObj<NotificationService>;
    service.adminUpdate.and.returnValue(
      throwError(() => ({ status: 422, error: { errors: ['kaputt'] } }))
    );
    const component = createComponent();

    component.submit();

    expect(notification.error).not.toHaveBeenCalled();
    expect(component.saving).toBeFalse();
  });

  it('schaltet ein Bundesland um und haelt die Auswahl sortiert', () => {
    const component = createComponent();

    component.toggleState('de-nw');
    component.toggleState('de-be');

    // Sortiert und nicht in Klickreihenfolge, damit die Anzeige stabil bleibt.
    expect(component.stateAssociation.states).toEqual([
      'de-be',
      'de-nw',
      'de-st',
    ]);

    component.toggleState('de-st');

    expect(component.stateAssociation.states).toEqual(['de-be', 'de-nw']);
  });

  it('sendet den Zustaendigkeitsbereich mit', () => {
    const component = createComponent();
    component.toggleState('de-st');
    component.toggleState('de-nw');

    component.submit();

    const payload = service.adminUpdate.calls.mostRecent()
      .args[1] as StateAssociation;
    expect(payload.states).toEqual(['de-nw']);
  });

  it('nennt den ganzen greifenden Bereich im Klartext', () => {
    // Nur-Lese-Ansicht der SBK: eigene und geerbte Bundesländer zusammen.
    expect(createComponent().effectiveStateNames).toBe(
      'Sachsen, Sachsen-Anhalt'
    );
  });
});
