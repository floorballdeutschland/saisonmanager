import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import {
  GameOperationService,
  getTranslocoTestingModule,
  NotificationService,
  StateAssociationService,
} from '@floorball/core';
import {
  GameOperation,
  GameOperationAdmin,
  StateAssociation,
} from '@floorball/types';
import { GameOperationEditComponent } from './game-operation-edit.component';

const BESTAND: GameOperationAdmin = {
  id: 5,
  name: 'Floorballverband Schleswig-Holstein',
  short_name: 'FLV-SH',
  path: 'flvsh',
  slug: 'flvsh',
  national: false,
  state_association_id: 5,
  state_association_name: 'FLV Schleswig-Holstein',
  banner_url: null,
  banner_link_url: null,
  dependencies: { leagues: 3, clubs: 12, users: 2 },
};

// Die Liste, aus der die Maske ableitet, welche Landesverbände schon einen
// Spielbetrieb tragen. Der eigene Datensatz (id 5) ist dabei, damit der Test
// zeigt, dass er die eigene Auswahl NICHT sperrt.
const ALLE_SPIELBETRIEBE = [
  {
    id: 5,
    name: 'FLV-SH',
    short_name: 'FLV-SH',
    path: 'flvsh',
    state_association_id: 5,
  },
  {
    id: 2,
    name: 'FVNB',
    short_name: 'FVNB',
    path: 'fvnb',
    state_association_id: 2,
  },
] as unknown as GameOperation[];

const ALLE_LV = [
  { id: 2, name: 'Floorball Niedersachsen' },
  { id: 5, name: 'FLV Schleswig-Holstein' },
  { id: 14, name: 'Floorball Bund Hamburg' },
] as unknown as StateAssociation[];

describe('GameOperationEditComponent', () => {
  let service: jasmine.SpyObj<GameOperationService>;
  // Veraenderlich und vom Provider eingeschlossen: overrideProvider greift nach
  // compileComponents() nicht mehr, der Test bekaeme still die Bearbeiten-Route.
  let routeParams: { id?: string };

  // null heisst „Neuanlage-Route". Nicht undefined: Das loest den
  // Default-Parameter aus, und der Test bekaeme still die Bearbeiten-Route.
  const createComponent = (routeId: string | null = '5') => {
    if (routeId === null) {
      delete routeParams.id;
    } else {
      routeParams.id = routeId;
    }
    const fixture = TestBed.createComponent(GameOperationEditComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  beforeEach(async () => {
    routeParams = {};
    service = jasmine.createSpyObj<GameOperationService>(
      'GameOperationService',
      ['adminGet', 'adminCreate', 'adminUpdate', 'getAdminGameOperations']
    );
    service.adminGet.and.returnValue(of(BESTAND));
    service.adminCreate.and.returnValue(of(BESTAND));
    service.adminUpdate.and.returnValue(of(BESTAND));
    service.getAdminGameOperations.and.returnValue(of(ALLE_SPIELBETRIEBE));

    const stateAssociationService =
      jasmine.createSpyObj<StateAssociationService>('StateAssociationService', [
        'adminGetAll',
      ]);
    stateAssociationService.adminGetAll.and.returnValue(of(ALLE_LV));

    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [GameOperationEditComponent],
      providers: [
        { provide: GameOperationService, useValue: service },
        { provide: StateAssociationService, useValue: stateAssociationService },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj<NotificationService>(
            'NotificationService',
            ['success', 'error']
          ),
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: routeParams } },
        },
      ],
    })
      .overrideTemplate(GameOperationEditComponent, '')
      .compileComponents();
  });

  it('laedt den Datensatz samt Zahlen der Abhaengigkeiten', () => {
    const component = createComponent();

    expect(component.editMode).toBeTrue();
    expect(component.gameOperation.path).toBe('flvsh');
    expect(component.hasDependencies).toBeTrue();
  });

  // Ein Landesverband hat hoechstens einen Spielbetrieb. Belegte Verbaende
  // gehoeren aus der Auswahl -- aber der EIGENE nicht, sonst faellt beim
  // Bearbeiten der gespeicherte Verband aus der eigenen Liste und das Speichern
  // schickt still null.
  it('sperrt belegte Landesverbaende, den eigenen aber nicht', () => {
    const ids = createComponent().selectableStateAssociations.map(
      (sa) => sa.id
    );

    expect(ids).toContain(5);
    expect(ids).toContain(14);
    expect(ids).not.toContain(2);
  });

  // Beim Anlegen gibt es keinen eigenen Datensatz, dann sind beide belegten
  // Verbaende zu sperren.
  it('sperrt beim Anlegen alle belegten Landesverbaende', () => {
    const ids = createComponent(null).selectableStateAssociations.map(
      (sa) => sa.id
    );

    expect(ids).toEqual([14]);
  });

  // Die Vorschau muss dieselbe Ableitung zeigen wie die API, sonst erfaehrt der
  // Nutzer die Adresse erst nach dem Speichern.
  it('leitet die Pfadvorschau aus dem Kuerzel ab, solange kein Pfad steht', () => {
    const component = createComponent();
    component.gameOperation.path = '';
    component.gameOperation.short_name = 'SBK Ost';

    expect(component.pathPreview).toBe('sbk-ost');

    component.gameOperation.path = '  FLVSH ';

    expect(component.pathPreview).toBe('flvsh');
  });

  // Einen leeren Pfad leer mitschicken ist Absicht: Dann leitet die API ihn ab
  // und speichert ihn. Den Vorschauwert zu senden schriebe die Ableitung als
  // eigenen Eintrag fest, und eine spaetere Kuerzel-Aenderung zoege den Pfad
  // nicht mehr mit.
  it('schickt einen leeren Pfad leer und nicht als Vorschauwert', () => {
    const component = createComponent();
    component.gameOperation.path = '';
    component.gameOperation.short_name = 'SBK Ost';
    component.submit();

    expect(service.adminUpdate).toHaveBeenCalledWith(
      5,
      jasmine.objectContaining({ path: '' })
    );
  });

  it('speichert national mit', () => {
    const component = createComponent();
    component.gameOperation.national = true;
    component.submit();

    expect(service.adminUpdate).toHaveBeenCalledWith(
      5,
      jasmine.objectContaining({ national: true })
    );
  });

  it('speichert nicht ohne Name oder Kuerzel', () => {
    const component = createComponent();
    component.gameOperation.short_name = '  ';
    component.submit();

    expect(service.adminUpdate).not.toHaveBeenCalled();
  });

  it('meldet keine Abhaengigkeiten, wenn alle Zahlen null sind', () => {
    service.adminGet.and.returnValue(
      of({ ...BESTAND, dependencies: { leagues: 0, clubs: 0, users: 0 } })
    );

    expect(createComponent().hasDependencies).toBeFalse();
  });
});
