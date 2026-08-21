import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import {
  GameOperationService,
  getTranslocoTestingModule,
  NotificationService,
} from '@floorball/core';
import {
  GameOperation,
  GameOperationAdmin,
  StateAssociation,
} from '@floorball/types';
import { GameOperationSectionComponent } from './game-operation-section.component';

// Der Abschnitt „Spielbetrieb" in der Verbandsmaske. Geprüft wird vor allem,
// welche der drei Lagen er zeigt -- Formular, Anlege-Knopf oder der Hinweis auf
// den Verbund -- und dass er ohne Recht nichts abfragt.
const WURZEL_LV = {
  id: 7,
  name: 'Floorball Verband Hessen e.V.',
  short_name: 'FVH',
} as StateAssociation;
const KIND_LV = {
  id: 14,
  name: 'Floorball Bund Hamburg e.V.',
  short_name: 'FBH',
  parent_id: 5,
} as StateAssociation;
const VERBUND_LV = {
  id: 5,
  name: 'Floorballverband Schleswig-Holstein e.V.',
  short_name: 'FLV-SH',
} as StateAssociation;

const LISTE: GameOperation[] = [
  {
    id: 8,
    name: 'Floorball Verband Hessen',
    short_name: 'FVH',
    state_association_id: 7,
  } as GameOperation,
];

const DETAIL: GameOperationAdmin = {
  id: 8,
  name: 'Floorball Verband Hessen',
  short_name: 'FVH',
  path: 'fvh',
  slug: 'fvh',
  national: false,
  state_association_id: 7,
  state_association_name: 'Floorball Verband Hessen e.V.',
  dependencies: {
    leagues: 3,
    clubs: 12,
    users: 2,
    referees: 0,
    document_types: 0,
    referee_tags: 0,
    releases: 0,
  },
};

describe('GameOperationSectionComponent', () => {
  let service: jasmine.SpyObj<GameOperationService>;

  beforeEach(() => {
    service = jasmine.createSpyObj('GameOperationService', [
      'getAdminGameOperations',
      'adminGet',
      'adminCreate',
      'adminUpdate',
      'adminDelete',
      'adminUploadBanner',
      'adminDeleteBanner',
    ]);
    service.getAdminGameOperations.and.returnValue(of(LISTE));
    service.adminGet.and.returnValue(of(DETAIL));
    service.adminCreate.and.returnValue(of(DETAIL));
    service.adminUpdate.and.returnValue(of(DETAIL));

    TestBed.configureTestingModule({
      declarations: [GameOperationSectionComponent],
      imports: [
        HttpClientTestingModule,
        FormsModule,
        getTranslocoTestingModule(),
      ],
      providers: [
        { provide: GameOperationService, useValue: service },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj('NotificationService', [
            'success',
            'error',
          ]),
        },
      ],
    });
  });

  function bauen(
    stateAssociation: StateAssociation,
    canManage = true,
    alle: StateAssociation[] = [WURZEL_LV, KIND_LV, VERBUND_LV]
  ): GameOperationSectionComponent {
    const fixture = TestBed.createComponent(GameOperationSectionComponent);
    fixture.componentInstance.stateAssociation = stateAssociation;
    fixture.componentInstance.allStateAssociations = alle;
    fixture.componentInstance.canManage = canManage;
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('laedt den Spielbetrieb des Verbands', () => {
    const component = bauen(WURZEL_LV);

    expect(service.adminGet).toHaveBeenCalledWith(8);
    expect(component.gameOperation?.short_name).toBe('FVH');
  });

  // Ohne das Recht antwortet die API auf jeden Zugriff mit 403, und der
  // ErrorInterceptor würde den Nutzer aus der Verbandsmaske werfen, die er sehr
  // wohl sehen darf. Der Abschnitt darf deshalb nicht einmal fragen.
  it('fragt ohne Recht gar nichts ab', () => {
    bauen(WURZEL_LV, false);

    expect(service.getAdminGameOperations).not.toHaveBeenCalled();
    expect(service.adminGet).not.toHaveBeenCalled();
  });

  it('meldet fuer einen Wurzelverband ohne Spielbetrieb keinen', () => {
    service.getAdminGameOperations.and.returnValue(of([]));

    const component = bauen(WURZEL_LV);

    expect(component.gameOperation).toBeNull();
    expect(component.isSubordinate).toBeFalse();
  });

  // Zustaendig ist immer der Spielbetrieb an der Wurzel des Verbandsbaums. Ein
  // eigener am Kind-Verband haette keine Vereine, deshalb bietet der Abschnitt
  // dort kein Formular an, sondern nennt den Verbund.
  it('nennt bei einem untergeordneten Verband den Verbund', () => {
    const component = bauen(KIND_LV);

    expect(component.isSubordinate).toBeTrue();
    expect(component.verbundName).toBe(
      'Floorballverband Schleswig-Holstein e.V.'
    );
  });

  // Genau die Drift, die den Umbau ausgeloest hat: Am Spielbetrieb stand
  // „rlpsaar" als Kuerzel, am Verband „RLPSAAR". Beim Anlegen kommt es jetzt
  // aus dem Verband, das „e.V." faellt weg (kein Spielbetrieb traegt es).
  it('belegt Name und Kuerzel aus dem Verband vor', () => {
    service.getAdminGameOperations.and.returnValue(of([]));
    const component = bauen(WURZEL_LV);

    component.startCreate();

    expect(component.gameOperation?.name).toBe('Floorball Verband Hessen');
    expect(component.gameOperation?.short_name).toBe('FVH');
  });

  // Der Verband ist der Zusammenhang, in dem der Abschnitt steht, kein Feld.
  // Was der Nutzer auch tippt: Gespeichert wird gegen diesen Verband.
  it('schickt immer den Verband der Maske mit', () => {
    service.getAdminGameOperations.and.returnValue(of([]));
    const component = bauen(WURZEL_LV);
    component.startCreate();

    component.submit();

    expect(service.adminCreate).toHaveBeenCalledWith(
      jasmine.objectContaining({ state_association_id: 7 })
    );
  });

  it('speichert einen vorhandenen Spielbetrieb per update', () => {
    const component = bauen(WURZEL_LV);

    component.submit();

    expect(service.adminUpdate).toHaveBeenCalledWith(8, jasmine.anything());
    expect(service.adminCreate).not.toHaveBeenCalled();
  });

  // Die API riegelt das Loeschen an sieben Zahlen ab, nicht an drei.
  it('zaehlt alle sieben Abhaengigkeitsarten', () => {
    service.adminGet.and.returnValue(
      of({
        ...DETAIL,
        dependencies: {
          leagues: 0,
          clubs: 0,
          users: 0,
          referees: 0,
          document_types: 0,
          referee_tags: 1,
          releases: 0,
        },
      })
    );

    expect(bauen(WURZEL_LV).hasDependencies).toBeTrue();
  });

  it('leitet den Pfad fuer die Vorschau aus dem Kuerzel ab', () => {
    service.getAdminGameOperations.and.returnValue(of([]));
    const component = bauen(WURZEL_LV);
    component.startCreate();
    component.gameOperation!.short_name = 'FLV SH';

    expect(component.pathPreview).toBe('flv-sh');
  });
});
