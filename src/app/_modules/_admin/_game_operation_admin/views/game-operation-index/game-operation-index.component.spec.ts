import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import {
  GameOperationService,
  getTranslocoTestingModule,
  NotificationService,
  StateAssociationService,
} from '@floorball/core';
import { GameOperation, StateAssociation } from '@floorball/types';
import { GameOperationIndexComponent } from './game-operation-index.component';

const SPIELBETRIEBE = [
  {
    id: 1,
    name: 'Floorball Deutschland',
    short_name: 'FVD',
    path: 'fvd',
    national: true,
    state_association_id: 1,
  },
  {
    id: 2,
    name: 'Floorball Niedersachsen',
    short_name: 'FVNB',
    path: 'fvnb',
    national: false,
    state_association_id: 2,
  },
  // Ohne Landesverband: gueltiger Zustand, aber einer, der benannt gehoert.
  {
    id: 3,
    name: 'Verband ohne LV',
    short_name: 'OHN',
    path: 'ohn',
    national: false,
    state_association_id: null,
  },
] as unknown as GameOperation[];

describe('GameOperationIndexComponent', () => {
  let service: jasmine.SpyObj<GameOperationService>;

  const createComponent = () => {
    const fixture = TestBed.createComponent(GameOperationIndexComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj<GameOperationService>(
      'GameOperationService',
      ['getAdminGameOperations', 'adminDelete']
    );
    service.getAdminGameOperations.and.returnValue(of(SPIELBETRIEBE));
    service.adminDelete.and.returnValue(of({}));

    const stateAssociationService =
      jasmine.createSpyObj<StateAssociationService>('StateAssociationService', [
        'adminGetAll',
      ]);
    stateAssociationService.adminGetAll.and.returnValue(
      of([
        { id: 1, name: 'Floorball Deutschland' },
        { id: 2, name: 'Floorball Niedersachsen' },
      ] as unknown as StateAssociation[])
    );

    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [GameOperationIndexComponent],
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
      ],
    })
      .overrideTemplate(GameOperationIndexComponent, '')
      .compileComponents();
  });

  it('laedt die Spielbetriebe', () => {
    const component = createComponent();

    expect(component.gameOperations.length).toBe(3);
    expect(component.loading).toBeFalse();
  });

  // Die Liste traegt nur die state_association_id; den Namen loest die
  // Komponente aus der Verbandsliste auf.
  it('loest den Namen des Landesverbands auf', () => {
    const component = createComponent();

    expect(component.stateAssociationName(SPIELBETRIEBE[1])).toBe(
      'Floorball Niedersachsen'
    );
  });

  // Kein Landesverband heisst „fuer keinen Verein zustaendig". Als leere Zelle
  // saehe das wie ein Ladefehler aus.
  it('benennt einen Spielbetrieb ohne Landesverband', () => {
    const component = createComponent();

    expect(component.stateAssociationName(SPIELBETRIEBE[2])).toBeTruthy();
  });

  // Fuer einen Verband, der (noch) nicht in der Liste steht, bleibt die ID
  // sichtbar, statt ihn als „keiner" auszugeben -- das waere eine Falschaussage.
  it('faellt auf die ID zurueck, wenn der Verband nicht in der Liste steht', () => {
    const component = createComponent();

    expect(
      component.stateAssociationName({
        state_association_id: 99,
      } as unknown as GameOperation)
    ).toBe('#99');
  });

  it('loescht nach Bestaetigung und laedt neu', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const component = createComponent();
    component.delete(SPIELBETRIEBE[2]);

    expect(service.adminDelete).toHaveBeenCalledWith(3);
    expect(service.getAdminGameOperations).toHaveBeenCalledTimes(2);
  });

  it('loescht nicht ohne Bestaetigung', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    const component = createComponent();
    component.delete(SPIELBETRIEBE[2]);

    expect(service.adminDelete).not.toHaveBeenCalled();
  });
});
