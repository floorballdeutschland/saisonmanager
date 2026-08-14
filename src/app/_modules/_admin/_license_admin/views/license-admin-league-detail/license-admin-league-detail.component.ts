import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  Club,
  League,
  PlayerWithLicense,
  TeamWithPlayers,
} from '@floorball/types';
import { ClubService, LeagueService } from '@floorball/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'fb-license-admin-league-detail',
  templateUrl: './license-admin-league-detail.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class LicenseAdminLeagueDetailComponent implements OnInit, OnDestroy {
  teams: TeamWithPlayers[] = [];
  allClubs: Club[] = [];
  league?: League;
  private _leagueId?: number;

  handledPlayerIds: number[] = [];
  copyLoading = false;
  copyResult?: { copied: number };

  allOpen = false;
  toggleAll(): void {
    this.allOpen = !this.allOpen;
  }

  private _destroy$ = new Subject<void>();

  constructor(
    private _leagueService: LeagueService,
    private _clubService: ClubService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title,
    private _transloco: TranslocoService
  ) {}

  ngOnInit(): void {
    // Titel erst setzen, wenn der lazy geladene Scope 'admin/license' verfügbar
    // ist – im Konstruktor liefert translate() sonst nur den rohen Key-Pfad.
    // selectTranslate() lädt scope-korrekt und emittiert erst nach dem Laden;
    // selectTranslation('admin/license') fehlinterpretiert den zweistufigen Pfad.
    this._transloco
      .selectTranslate('leagueDetail.metaTitle', {}, 'admin/license')
      .pipe(takeUntil(this._destroy$))
      .subscribe(() =>
        this._metaTitle.setTitle(
          this._transloco.translate('licenseAdmin.leagueDetail.metaTitle')
        )
      );

    this._route.params.pipe(takeUntil(this._destroy$)).subscribe((params) => {
      const parsed = parseInt(params['leagueId'], 10);
      this._leagueId = Number.isNaN(parsed) ? undefined : parsed;
      this.getGameOperations();
    });
    this.getAllClubs();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public getGameOperations(): void {
    if (!this._leagueId) return;

    this._leagueService
      .getSingleLeague(this._leagueId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (league) => {
          this.league = league;
          this._cdr.markForCheck();
        },
      });

    this._leagueService
      .getAdminLeagueLicenses(this._leagueId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (teams) => {
          this.teams = teams;
          this._cdr.markForCheck();
        },
      });
  }

  public getAllClubs(): void {
    this._clubService
      .getAdminClubAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.allClubs = result;
          this._cdr.markForCheck();
        },
      });
  }

  public handledPlayer(playerId: number) {
    this.handledPlayerIds.push(playerId);
    this.getGameOperations();
  }

  public copyPreroundLicenses(): void {
    if (!this.league?.id) return;
    this.copyLoading = true;
    this.copyResult = undefined;
    this._leagueService
      .copyPreroundLicenses(this.league.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.copyResult = result;
          this.copyLoading = false;
          this.getGameOperations();
          this._cdr.markForCheck();
        },
        error: () => {
          this.copyLoading = false;
          this._cdr.markForCheck();
        },
      });
  }

  public docTypeLabel(docType: string): string {
    const labels: Record<string, string> = {
      id_copy: this._transloco.translate(
        'licenseAdmin.leagueDetail.docLabelIdCopy'
      ),
    };
    return labels[docType] ?? docType;
  }

  // Elternzustimmung verlangt die Liga, nicht das Geburtsdatum allein: Die API
  // löst beides auf (Liga-Flag bzw. eingetragene Dokumentart, Alter am Tag der
  // Beantragung) und liefert das Ergebnis in required_documents. Vorher prüfte
  // die Ansicht nur „minderjährig heute" und meldete die Zustimmung deshalb
  // bundesweit als fehlend, auch in Ligen ohne diese Pflicht.
  public needsParentalConsent(player: PlayerWithLicense): boolean {
    return !!player.team_license?.required_documents?.includes(
      'parental_consent'
    );
  }
}
