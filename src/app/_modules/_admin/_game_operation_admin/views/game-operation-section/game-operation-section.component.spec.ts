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
    // Ueber setInput und nicht per Zuweisung: Der Abschnitt laedt in
    // ngOnChanges, und das feuert nur fuer echte Input-Bindungen.
    fixture.componentRef.setInput('stateAssociation', stateAssociation);
    fixture.componentRef.setInput('allStateAssociations', alle);
    fixture.componentRef.setInput('canManage', canManage);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  // Die Verbandsmaske rendert den Abschnitt, sobald sie aus der Route weiss,
  // dass sie im Bearbeiten-Modus ist -- der Verband selbst kommt erst mit der
  // Antwort des Detail-Endpunkts hinterher. Wurde nur in ngOnInit abgerufen,
  // blieb der Abschnitt bei dem leeren Verband stehen, mit dem er angelegt
  // wurde: In der laufenden Anwendung meldete er dann fuer jeden Verband „noch
  // kein Spielbetrieb", waehrend die Spezifikationen gruen blieben, weil sie
  // die Eingaben vor dem ersten Rendern setzen.
  it('laedt nach, wenn der Verband erst nach dem Rendern eintrifft', () => {
    const fixture = TestBed.createComponent(GameOperationSectionComponent);
    fixture.componentRef.setInput('stateAssociation', {
      name: '',
      short_name: '',
    });
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    expect(service.getAdminGameOperations).not.toHaveBeenCalled();

    fixture.componentRef.setInput('stateAssociation', WURZEL_LV);
    fixture.detectChanges();

    expect(service.adminGet).toHaveBeenCalledWith(8);
  });

  // Dasselbe fuer das Recht: Es haengt am Nutzer aus der Session, der ebenfalls
  // nach dem ersten Rendern eintreffen kann.
  it('laedt nach, wenn das Recht erst nach dem Rendern feststeht', () => {
    const fixture = TestBed.createComponent(GameOperationSectionComponent);
    fixture.componentRef.setInput('stateAssociation', WURZEL_LV);
    fixture.componentRef.setInput('canManage', false);
    fixture.detectChanges();

    expect(service.getAdminGameOperations).not.toHaveBeenCalled();

    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    expect(service.adminGet).toHaveBeenCalledWith(8);
  });

  // Jede Eingabe im Formular loest eine Pruefrunde aus, und ngOnChanges feuert
  // dabei mit. Der Abruf darf sich davon nicht wiederholen.
  it('ruft denselben Verband nicht mehrfach ab', () => {
    const fixture = TestBed.createComponent(GameOperationSectionComponent);
    fixture.componentRef.setInput('stateAssociation', WURZEL_LV);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    fixture.componentRef.setInput('allStateAssociations', [WURZEL_LV]);
    fixture.detectChanges();

    expect(service.getAdminGameOperations).toHaveBeenCalledTimes(1);
  });

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

  // Der Verbundname kommt aus dem Detail-Datensatz und nicht aus der Liste:
  // Beide Abrufe der Verbandsmaske laufen nebeneinander, und gewinnt der
  // Detail-Endpunkt, ist die Liste noch leer.
  it('nennt den Verbund auch ohne geladene Verbandsliste', () => {
    const component = bauen(
      { ...KIND_LV, parent_name: 'Verbund Nord' } as StateAssociation,
      true,
      []
    );

    expect(component.verbundName).toBe('Verbund Nord');
  });

  // Ein untergeordneter Verband soll keinen eigenen Spielbetrieb haben, kann
  // aber einen tragen. Verschwiegen waere er nirgends mehr zu sehen und damit
  // auch nicht mehr zu loeschen.
  it('zeigt einen gestrandeten Spielbetrieb am untergeordneten Verband', () => {
    service.getAdminGameOperations.and.returnValue(
      of([{ ...LISTE[0], id: 9, state_association_id: 14 } as GameOperation])
    );
    service.adminGet.and.returnValue(
      of({ ...DETAIL, id: 9, state_association_id: 14 })
    );

    const fixture = TestBed.createComponent(GameOperationSectionComponent);
    fixture.componentRef.setInput('stateAssociation', KIND_LV);
    fixture.componentRef.setInput('allStateAssociations', [
      KIND_LV,
      VERBUND_LV,
    ]);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    expect(fixture.componentInstance.isSubordinate).toBeTrue();
    // Das Formular, nicht nur der Datensatz: Vorher lud der Abschnitt ihn zwar,
    // zeigte aber allein den Verbundhinweis -- ohne Loeschen-Knopf.
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('gameOperationAdmin.section.subordinateStranded');
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        'input[type="text"]'
      ).length
    ).toBeGreaterThan(0);
  });

  // Ein untergeordneter Verband ohne eigenen Spielbetrieb bekommt weiterhin nur
  // den Hinweis -- und vor allem keinen Anlege-Knopf.
  it('bietet einem untergeordneten Verband kein Anlegen an', () => {
    service.getAdminGameOperations.and.returnValue(of([]));

    const fixture = TestBed.createComponent(GameOperationSectionComponent);
    fixture.componentRef.setInput('stateAssociation', KIND_LV);
    fixture.componentRef.setInput('allStateAssociations', [
      KIND_LV,
      VERBUND_LV,
    ]);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('gameOperationAdmin.section.subordinateHint');
    expect(text).not.toContain('gameOperationAdmin.section.createButton');
  });

  // Die API setzt den Banner-Link bei jedem Upload aus dem Parameter. Fehlt er,
  // loescht ein Bild-Upload den vorhandenen Link -- lautlos, denn die Maske
  // zeigt danach weiter den alten Wert.
  it('schickt den Banner-Link beim Upload mit', () => {
    service.adminGet.and.returnValue(
      of({ ...DETAIL, banner_link_url: 'https://fvh.example.com' })
    );
    service.adminUploadBanner.and.returnValue(
      of({ banner_url: '/b.png', banner_link_url: 'https://fvh.example.com' })
    );
    const component = bauen(WURZEL_LV);
    const file = new File(['x'], 'banner.png', { type: 'image/png' });
    const input = {
      files: [file],
      value: 'banner.png',
    } as unknown as HTMLInputElement;

    component.onBannerSelected(input);

    expect(service.adminUploadBanner).toHaveBeenCalledWith(
      8,
      file,
      'https://fvh.example.com'
    );
    expect(component.gameOperation?.banner_link_url).toBe(
      'https://fvh.example.com'
    );
  });

  it('leitet den Pfad fuer die Vorschau aus dem Kuerzel ab', () => {
    service.getAdminGameOperations.and.returnValue(of([]));
    const component = bauen(WURZEL_LV);
    component.startCreate();
    component.gameOperation!.short_name = 'FLV SH';

    expect(component.pathPreview).toBe('flv-sh');
  });
});
