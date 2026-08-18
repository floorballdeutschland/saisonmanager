import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { PlayerEditComponent } from './player-edit.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import {
  getTranslocoTestingModule,
  PlayerService,
  SessionService,
} from '@floorball/core';
import { RouterTestingModule } from '@angular/router/testing';
import { UikitCommonModule } from '@floorball/uikit/common';
import { UikitMatchesModule } from '@floorball/uikit/matches';
import { UikitPlayerModule } from '@floorball/uikit/player';
import { UikitTeamModule } from '@floorball/uikit/team';
import {
  LicenseDocument,
  Player,
  PlayerLicense,
  Season,
  User,
} from '@floorball/models';

describe('PlayerEditComponent', () => {
  let currentUser$: BehaviorSubject<User | null>;

  beforeEach(async () => {
    currentUser$ = new BehaviorSubject<User | null>(null);
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
        UikitCommonModule,
        UikitPlayerModule,
        UikitTeamModule,
        UikitMatchesModule,
      ],
      declarations: [PlayerEditComponent],
      // Mit playerId in der Route bleibt editMode true, sonst schaltet ngOnInit
      // beim ersten detectChanges auf die Neuanlage um.
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { params: of({ playerId: '7' }) },
        },
        { provide: SessionService, useValue: { currentUser$ } },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(PlayerEditComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('licenseSeasonGroups', () => {
    function license(id: string, seasonId?: number | string): PlayerLicense {
      return {
        id,
        team_id: 1,
        history: [],
        season_id: seasonId,
        league_class_id: '',
        requested_at: '',
      } as PlayerLicense;
    }

    function build(): PlayerEditComponent {
      const component =
        TestBed.createComponent(PlayerEditComponent).componentInstance;
      component.seasons = [
        { id: 17, name: '2025/2026', current: false },
        { id: 18, name: '2026/2027', current: true },
        { id: 16, name: '2024/2025', current: false },
      ] as Season[];
      component.currentSeasonId = 18;
      return component;
    }

    it('groups by season, current first then descending, no-season last', () => {
      const component = build();
      component.player = {
        licenses: [
          license('a', 17),
          license('b', 18),
          license('c', undefined),
          license('d', 16),
        ],
      } as Player;

      const groups = component.licenseSeasonGroups();

      expect(groups.map((g) => g.seasonId)).toEqual([
        '18',
        '17',
        '16',
        undefined,
      ]);
      expect(groups[0].current).toBe(true);
      expect(groups[0].name).toBe('2026/2027');
      expect(groups[3].name).toBe('');
    });

    it('collects multiple licenses of the same season into one group', () => {
      const component = build();
      component.player = {
        licenses: [license('a', 18), license('b', 18)],
      } as Player;

      const groups = component.licenseSeasonGroups();

      expect(groups.length).toBe(1);
      expect(groups[0].licenses.map((l) => l.id)).toEqual(['a', 'b']);
    });

    it('marks only current-season licenses as editable', () => {
      const component = build();

      expect(component.isCurrentSeasonLicense(license('a', 18))).toBe(true);
      expect(component.isCurrentSeasonLicense(license('b', 17))).toBe(false);
      expect(component.isCurrentSeasonLicense(license('c', undefined))).toBe(
        false
      );
    });
  });

  // Der Verweis auf die Transferanträge ersetzt einen direkten Wechsel am
  // Profil und darf nur bei den Rollen auftauchen, die dort auch die
  // Direktzuweisung auslösen dürfen.
  describe('Verweis auf die Transferanträge', () => {
    // Die Berechtigung muss vor dem ersten Rendern stehen: die Komponente liest
    // sie in ngOnInit aus currentUser$, ein spaeteres Setzen des Feldes laeuft
    // nicht mehr in die Bindings (Angular 22, dirty-getrackte Views).
    function render(
      permissions: Record<string, boolean>
    ): ComponentFixture<PlayerEditComponent> {
      currentUser$.next({ permissions } as unknown as User);
      const fixture = TestBed.createComponent(PlayerEditComponent);
      fixture.componentInstance.player = { id: 7 } as Player;
      // Ohne checkNoChanges: die Saison-Abos liefern ihren Wert erst im selben
      // Durchlauf nach, das ist hier nicht der Prüflingsteil.
      fixture.detectChanges(false);
      return fixture;
    }

    function link(
      fixture: ComponentFixture<PlayerEditComponent>
    ): Element | null {
      return fixture.nativeElement.querySelector(
        'a[href="/verwaltung/transfer-anfragen"]'
      );
    }

    it('links to the transfer requests for SBK and admin', () => {
      expect(link(render({ menu_item_transfer_requests_sbk: true }))).not.toBe(
        null
      );
    });

    it('hides the link for club and team managers', () => {
      expect(link(render({ menu_item_player_admin: true }))).toBe(null);
    });
  });

  describe('Dokument-Upload', () => {
    function build(): PlayerEditComponent {
      const component =
        TestBed.createComponent(PlayerEditComponent).componentInstance;
      component.player = { id: 7 } as Player;
      component.licenseDocuments = [
        { id: 1, document_type: 'use' } as LicenseDocument,
      ];
      return component;
    }

    it('names the document a new upload of the same type would replace', () => {
      const component = build();

      expect(component.documentToBeReplaced).toBeUndefined();

      component.uploadDocumentType = 'use';
      expect(component.documentToBeReplaced?.id).toBe(1);

      component.uploadDocumentType = 'id_copy';
      expect(component.documentToBeReplaced).toBeUndefined();
    });

    // Die Grenze steht auch serverseitig (LicenseDocument::MAX_FILE_SIZE). Ohne
    // die Vorprüfung liefe die Datei erst durch die Leitung und käme als 422
    // zurück.
    it('rejects a file above 10 MB without calling the API', () => {
      const component = build();
      const playerService = TestBed.inject(PlayerService);
      const upload = spyOn(playerService, 'uploadLicenseDocument');
      component.uploadDocumentType = 'id_copy';

      component.onDocumentFileSelected(
        fileEvent({ size: 11 * 1024 * 1024 } as File)
      );

      expect(upload).not.toHaveBeenCalled();
      expect(component.uploadErrorKey).toBe(
        'playerAdmin.edit.documentTooLarge'
      );
    });

    it('does nothing while no document type is selected', () => {
      const component = build();
      const playerService = TestBed.inject(PlayerService);
      const upload = spyOn(playerService, 'uploadLicenseDocument');

      component.onDocumentFileSelected(fileEvent({ size: 1024 } as File));

      expect(upload).not.toHaveBeenCalled();
      expect(component.uploadErrorKey).toBeNull();
    });

    function fileEvent(file: File): Event {
      return {
        target: { files: [file], value: 'c:\\fake' },
      } as unknown as Event;
    }
  });
});
