import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import { AssociationService, LeagueService } from '@floorball/core';
import { LeagueWithTeams, Team } from 'src/app/_models';
import { Observable, share, Subject, take, takeUntil } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';

interface FlatLeague {
  id: number;
  name: string;
  goName: string;
}

@Component({
  templateUrl: './team-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TeamIndexComponent implements OnInit, OnDestroy {
  league$?: Observable<LeagueWithTeams>;

  showImport = false;
  allLeagues: FlatLeague[] = [];
  importSourceLeagueId: number | null = null;
  importTopN = 2;
  importResult: { imported: number; skipped: number; failed: number } | null =
    null;
  importing = false;

  // Bestandsmannschaften aufnehmen (Pokal/Endrunde): Quell-Liga wählen, aus ihren
  // Mannschaften auswählen. Anders als der Import kopiert das nichts, sondern
  // trägt diese Liga in `cup_leagues` der Mannschaft ein.
  showAdd = false;
  addSourceLeagueId: number | null = null;
  candidateTeams: Team[] = [];
  selectedTeamIds: number[] = [];
  loadingCandidates = false;
  adding = false;
  addResult: { added: number; skipped: number; failed: number } | null = null;
  removingTeamId: number | null = null;

  private _leagueId = 0;
  private _destroy$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this._route.params.subscribe((params) => {
      if (params['leagueId']) {
        this._leagueId = +params['leagueId'];
        this.league$ = this._leagueService
          .getLeagueWithTeams(params['leagueId'])
          .pipe(share());

        this._leagueService
          .getAdminLeagues()
          .pipe(take(1), takeUntil(this._destroy$))
          .subscribe((groups) => {
            this.allLeagues = groups.flatMap((g) =>
              (g.leagues || []).map((l) => ({
                id: l.id,
                name: l.name,
                goName: g.name,
              }))
            );
            this._cdr.markForCheck();
          });

        this._cdr.markForCheck();
      }
    });
  }

  // Die Mannschaften der gewählten Quell-Liga. Der Lese-Endpoint ist für
  // Admin/SBK auch über Spielbetriebsgrenzen offen, deshalb genügt der
  // bestehende Aufruf.
  // Wechsel der Quell-Liga: Auswahl und Rueckmeldung der letzten Aufnahme
  // verwerfen, sie gehoeren zur vorherigen Liga.
  public onSourceLeagueChange(): void {
    this.addResult = null;
    this.loadCandidates();
  }

  // Bewusst ohne Zuruecksetzen von addResult: Nach einer Aufnahme wird die Liste
  // neu geladen, und die Rueckmeldung dazu soll stehen bleiben.
  public loadCandidates(): void {
    this.selectedTeamIds = [];
    this.candidateTeams = [];
    if (!this.addSourceLeagueId) return;

    this.loadingCandidates = true;
    this._leagueService
      .getLeagueWithTeams(this.addSourceLeagueId)
      .pipe(take(1), takeUntil(this._destroy$))
      .subscribe({
        next: (league) => {
          // Mannschaften, die schon zu diesem Wettbewerb gehören, gar nicht erst
          // anbieten – der Endpoint würde sie überspringen, aber die Liste soll
          // zeigen, was noch offen ist.
          this.candidateTeams = (league.teams || []).filter(
            (t) =>
              t.league_id !== this._leagueId &&
              !(t.cup_leagues || []).includes(this._leagueId)
          );
          this.loadingCandidates = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loadingCandidates = false;
          this._cdr.markForCheck();
        },
      });
  }

  public isSelected(teamId: number): boolean {
    return this.selectedTeamIds.includes(teamId);
  }

  public toggleTeam(teamId: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedTeamIds = checked
      ? [...this.selectedTeamIds, teamId]
      : this.selectedTeamIds.filter((id) => id !== teamId);
  }

  public addTeams(): void {
    if (!this.selectedTeamIds.length || !this._leagueId) return;
    this.adding = true;
    this.addResult = null;
    this._leagueService
      .adminAddExistingTeams(this._leagueId, this.selectedTeamIds)
      .pipe(take(1), takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.addResult = result;
          this.adding = false;
          this.selectedTeamIds = [];
          this._reloadLeague();
          this.loadCandidates();
        },
        error: () => {
          this.adding = false;
          this._cdr.markForCheck();
        },
      });
  }

  // Nur für Gäste sinnvoll: Eine Mannschaft, deren Hauptliga dieser Wettbewerb
  // ist, gehört in die Mannschaftsverwaltung und wird hier nicht angetastet.
  public isGuestTeam(team: Team): boolean {
    return team.league_id !== this._leagueId;
  }

  public removeTeam(team: Team): void {
    if (!this.isGuestTeam(team) || !this._leagueId) return;
    this.removingTeamId = team.id;
    this._leagueService
      .adminRemoveExistingTeam(this._leagueId, team.id)
      .pipe(take(1), takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.removingTeamId = null;
          this._reloadLeague();
          this.loadCandidates();
        },
        error: () => {
          this.removingTeamId = null;
          this._cdr.markForCheck();
        },
      });
  }

  public importTeams(): void {
    if (!this.importSourceLeagueId || !this._leagueId) return;
    this.importing = true;
    this.importResult = null;
    this._leagueService
      .adminImportTeams(
        this._leagueId,
        this.importSourceLeagueId,
        this.importTopN
      )
      .pipe(take(1), takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.importResult = result;
          this.importing = false;
          this._reloadLeague();
        },
        error: () => {
          this.importing = false;
          this._cdr.markForCheck();
        },
      });
  }

  private _reloadLeague(): void {
    this.league$ = this._leagueService
      .getLeagueWithTeams(this._leagueId)
      .pipe(share());
    this._cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }
}
