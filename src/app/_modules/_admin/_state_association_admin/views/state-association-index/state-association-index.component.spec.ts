import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import {
  GameOperationService,
  getTranslocoTestingModule,
  NotificationService,
  SessionService,
  StateAssociationService,
} from '@floorball/core';
import { GameOperation, StateAssociation, User } from '@floorball/types';
import { StateAssociationIndexComponent } from './state-association-index.component';

// Die Liste ersetzt seit dem Zusammenlegen der Masken die eigene
// Spielbetriebs-Uebersicht. Geprueft wird deshalb vor allem, dass kein
// Spielbetrieb dabei unter den Tisch faellt.
const WURZEL_MIT = {
  id: 7,
  name: 'Floorball Verband Hessen e.V.',
  short_name: 'FVH',
} as StateAssociation;
const WURZEL_OHNE = {
  id: 5,
  name: 'Floorballverband Schleswig-Holstein e.V.',
  short_name: 'FLV-SH',
} as StateAssociation;
const KIND = {
  id: 14,
  name: 'Floorball Bund Hamburg e.V.',
  short_name: 'FBH',
  parent_id: 5,
} as StateAssociation;

const go = (id: number, kuerzel: string, saId: number | null) =>
  ({
    id,
    name: `Spielbetrieb ${kuerzel}`,
    short_name: kuerzel,
    state_association_id: saId,
  }) as GameOperation;

describe('StateAssociationIndexComponent', () => {
  let stateAssociations: jasmine.SpyObj<StateAssociationService>;
  let gameOperations: jasmine.SpyObj<GameOperationService>;

  beforeEach(async () => {
    stateAssociations = jasmine.createSpyObj<StateAssociationService>(
      'StateAssociationService',
      ['adminGetAll', 'adminDelete']
    );
    stateAssociations.adminGetAll.and.returnValue(
      of([WURZEL_MIT, WURZEL_OHNE, KIND])
    );

    gameOperations = jasmine.createSpyObj<GameOperationService>(
      'GameOperationService',
      ['getAdminGameOperations']
    );
    gameOperations.getAdminGameOperations.and.returnValue(
      of([go(8, 'FVH', 7)])
    );

    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [StateAssociationIndexComponent],
      providers: [
        { provide: StateAssociationService, useValue: stateAssociations },
        { provide: GameOperationService, useValue: gameOperations },
        {
          provide: SessionService,
          useValue: {
            currentUser$: of({
              permissions: { menu_item_game_operation_admin: true },
            } as unknown as User),
          } as unknown as SessionService,
        },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj<NotificationService>(
            'NotificationService',
            ['success', 'error']
          ),
        },
      ],
    })
      .overrideTemplate(StateAssociationIndexComponent, '')
      .compileComponents();
  });

  const bauen = () => {
    const fixture = TestBed.createComponent(StateAssociationIndexComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  it('nennt den Spielbetrieb eines Wurzelverbands', () => {
    expect(bauen().gameOperationLabel(WURZEL_MIT)).toBe('FVH');
  });

  it('nennt fuer einen Wurzelverband ohne Spielbetrieb keinen', () => {
    expect(bauen().gameOperationLabel(WURZEL_OHNE)).toBeNull();
  });

  // Zustaendig ist immer der Spielbetrieb an der Wurzel; ein untergeordneter
  // Verband bekommt in der Spalte deshalb „ueber den Verbund" und keinen Namen.
  it('nennt fuer einen untergeordneten Verband keinen eigenen', () => {
    expect(bauen().gameOperationLabel(KIND)).toBeNull();
  });

  // Ein untergeordneter Verband soll keinen eigenen Spielbetrieb haben, kann
  // aber einen tragen. Ohne diese Zeile stuende in der Spalte nur „ueber den
  // Verbund", und der Datensatz waere nirgends mehr zu sehen.
  it('nennt einen gestrandeten Spielbetrieb am untergeordneten Verband', () => {
    gameOperations.getAdminGameOperations.and.returnValue(
      of([go(8, 'FVH', 7), go(9, 'FBH', 14)])
    );

    const component = bauen();

    expect(component.strandedGameOperationLabel(KIND)).toBe('FBH');
    expect(component.strandedGameOperationLabel(WURZEL_MIT)).toBeNull();
  });

  // Ein Spielbetrieb ohne Verband haengt an keiner Verbandsseite. Ohne diesen
  // Hinweis waere er nach dem Zusammenlegen der Masken unsichtbar.
  it('nennt Spielbetriebe ohne Verband ausdruecklich', () => {
    gameOperations.getAdminGameOperations.and.returnValue(
      of([go(8, 'FVH', 7), go(99, 'ALT', null)])
    );

    const component = bauen();

    expect(component.orphanedGameOperations.length).toBe(1);
    expect(component.orphanedGameOperationNames).toBe('ALT');
  });

  // Ohne diese Merkung stuende nach einem gescheiterten Abruf in jeder Zeile
  // „keiner" -- nicht zu unterscheiden davon, dass wirklich keiner angelegt ist.
  it('merkt sich einen gescheiterten Abruf der Spielbetriebe', () => {
    gameOperations.getAdminGameOperations.and.returnValue(
      throwError(() => new Error('500'))
    );

    const component = bauen();

    expect(component.gameOperationsFailed).toBeTrue();
    expect(component.gameOperationLabel(WURZEL_MIT)).toBeNull();
  });

  // Ohne das Recht antwortet der Auswahl-Endpunkt nach Rolle gescopt statt
  // vollstaendig; die Spalte waere dann nur halb wahr und wird nicht gerendert.
  it('fragt die Spielbetriebe ohne Recht gar nicht ab', () => {
    TestBed.overrideProvider(SessionService, {
      useValue: {
        currentUser$: of({
          permissions: { menu_item_state_association_sbk: true },
        } as unknown as User),
      } as unknown as SessionService,
    });

    const component = bauen();

    expect(component.canManageGameOperation).toBeFalse();
    expect(gameOperations.getAdminGameOperations).not.toHaveBeenCalled();
  });
});
