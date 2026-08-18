import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import {
  getTranslocoTestingModule,
  NotificationService,
  SessionService,
  StateAssociationService,
} from '@floorball/core';
import { StateAssociation } from '@floorball/types';
import { StateAssociationEditComponent } from './state-association-edit.component';

// Untergeordneter Landesverband, wie ihn der Detail-Endpunkt liefert: eigene
// Postfächer leer, die geerbten Werte als effective_* daneben. Die eigene
// Expresslizenz steht auf true, weil effective_express_license_enabled im
// Backend `eigener Wert ODER Verbund` ist.
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
  scan_required: false,
  referee_license_review_enabled: false,
  effective_referee_license_review_enabled: true,
  effective_express_license_enabled: true,
  effective_vsk_email: 'vsk@verbund.example.com',
  effective_sbk_email: 'sbk@verbund.example.com',
  effective_rsk_email: null,
  // Zuständigkeitsbereich: Sachsen-Anhalt selbst, Sachsen kommt über einen
  // untergeordneten Verband dazu. Die Vererbung läuft hier nach unten, deshalb
  // steht in effective_states mehr als in states.
  states: ['de-st'],
  effective_states: ['de-sn', 'de-st'],
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

  it('speichert Papierspielberichtsbogen und Expresslizenz eines Kind-LV', () => {
    const component = createComponent();
    component.stateAssociation.scan_required = true;

    component.submit();

    const payload = service.adminUpdate.calls.mostRecent()
      .args[1] as StateAssociation;
    // Beides wirkt über den Landesverband des Spielbetriebs, ein Kind-LV muss
    // die Werte für seine eigenen Spielbetriebe also setzen können.
    expect(payload.scan_required).toBeTrue();
    expect(payload.express_license_enabled).toBeTrue();
    // Vom Verbund bestimmt, das Backend erzwingt hier ebenfalls false.
    expect(payload.referee_license_review_enabled).toBeFalse();
    // Postfächer bleiben geerbt, kein eigener Eintrag am Kind-LV.
    expect(payload.vsk_email).toBeNull();
    expect(payload.sbk_email).toBeNull();
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
    expect(createComponent().effectiveStateNames).toBe('Sachsen, Sachsen-Anhalt');
  });
});
