import {
  ChangeDetectorRef,
  Component,
  Injector,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  afterNextRender,
} from '@angular/core';
import {
  Club,
  League,
  PlayerWithLicense,
  TeamWithPlayers,
} from '@floorball/types';
import {
  ClubService,
  LeagueService,
  NotificationService,
  PlayerService,
  SessionService,
} from '@floorball/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subject, take, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { readUploadedAt } from '../../_utils/document-upload-date';
import {
  isSuspendedStatus,
  licenseStatusBadgeClass,
} from 'src/app/_helpers/_utils/license-status';

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

  // Aus der Übersicht kommt der Spieler als Query-Parameter mit (?spieler=).
  // Seine Zeile wird hervorgehoben und angesprungen und, sofern er hier
  // überhaupt einen offenen Antrag hat, wird dieser aufgeklappt. Sonst müsste
  // man ihn in einer Liga mit vielen Anträgen erneut suchen.
  focusPlayerId?: number;
  private _focusApplied = false;
  copyLoading = false;
  copyResult?: { copied: number };

  // Sperren aufheben darf, wer sperren darf (Admin und SBK). Die Zeile zeigt
  // die Sperre auch allen anderen, aber ohne Knopf.
  canLiftSuspension = false;
  liftingSuspensionId?: number;

  public statusBadgeClass = licenseStatusBadgeClass;
  public isSuspendedStatus = isSuspendedStatus;

  allOpen = false;
  toggleAll(): void {
    this.allOpen = !this.allOpen;
  }

  private _destroy$ = new Subject<void>();

  constructor(
    private _leagueService: LeagueService,
    private _clubService: ClubService,
    private _playerService: PlayerService,
    private _sessionService: SessionService,
    private _notificationService: NotificationService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title,
    private _transloco: TranslocoService,
    private _injector: Injector
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

    this._route.queryParams
      .pipe(takeUntil(this._destroy$))
      .subscribe((query) => {
        const parsed = parseInt(query['spieler'], 10);
        const next = Number.isNaN(parsed) ? undefined : parsed;
        if (next === this.focusPlayerId) return;
        this.focusPlayerId = next;
        this._focusApplied = false;
        // Wechselt nur der Spieler (zweiter Klick aus der Übersicht in
        // dieselbe Liga), meldet sich params nicht erneut, weil der Router
        // allein die Pfad-Parameter vergleicht. Ohne das Nachladen hier bliebe
        // die Seite auf dem zuerst angesprungenen Spieler stehen, denn die
        // Antragskarten lesen initiallyOpen nur in ihrem ngOnInit. Wechselt
        // dagegen die Liga mit, lädt die params-Subscription ohnehin; der
        // Router setzt den Snapshot vor dem Melden, die neue Liga steht hier
        // also schon und wir halten uns heraus.
        const routedLeagueId = parseInt(
          this._route.snapshot.params['leagueId'],
          10
        );
        if (this._leagueId !== undefined && routedLeagueId === this._leagueId) {
          this.getGameOperations();
        }
      });

    this._sessionService.currentUser$.pipe(take(1)).subscribe((user) => {
      this.canLiftSuspension = !!(
        user?.permissions['player_suspend'] || user?.permissions['admin']
      );
      this._cdr.markForCheck();
    });

    this._route.params.pipe(takeUntil(this._destroy$)).subscribe((params) => {
      const parsed = parseInt(params['leagueId'], 10);
      this._leagueId = Number.isNaN(parsed) ? undefined : parsed;
      this.getGameOperations();
    });
    this.getAllClubs();
  }

  /**
   * Sperre aufheben, ohne die Ansicht zu wechseln.
   *
   * Bis api#605 fiel die gesperrte Zeile aus der Liste, und aufheben liess sich
   * die Sperre nur im Spielerprofil -- also genau dort nicht, wo die SBK
   * arbeitet. Der Endpunkt selbst besteht seit api#508.
   */
  public liftSuspension(playerId: number, suspensionId: number): void {
    if (!this.canLiftSuspension || this.liftingSuspensionId) return;

    this.liftingSuspensionId = suspensionId;
    this._playerService
      .liftSuspension(playerId, suspensionId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.liftingSuspensionId = undefined;
          this._notificationService.success(
            this._transloco.translate('licenseAdmin.leagueDetail.liftedNotice')
          );
          // Neu laden statt die Zeile im Speicher zu korrigieren: Der wirksame
          // Status entsteht serverseitig je Liga, und eine Sperre kann mehrere
          // Zeilen betreffen.
          this.getGameOperations();
        },
        error: () => {
          this.liftingSuspensionId = undefined;
          // 403 und 422 zeigt der globale ErrorInterceptor nicht an.
          this._notificationService.error(
            this._transloco.translate('licenseAdmin.leagueDetail.liftError')
          );
          this._cdr.markForCheck();
        },
      });
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
          this.scrollToFocusedPlayer();
        },
      });
  }

  // Nur der erste Ladevorgang springt. Die Liga wird nach jeder Entscheidung
  // und nach dem Übernehmen der Vorrundenlizenzen neu geladen; dann ist der
  // eben entschiedene Antrag weg, der Sprung fiele auf das Ersatzziel zurück
  // und risse die Ansicht aus der Antragsliste hinunter in die Mannschaften.
  private scrollToFocusedPlayer(): void {
    if (!this.focusPlayerId || this._focusApplied) return;
    this._focusApplied = true;
    const playerId = this.focusPlayerId;
    // Erst nach dem Rendern, sonst steht die Liste noch nicht im DOM und
    // getElementById liefert null (beim Neuladen: das alte Element).
    // afterNextRender läuft zudem nie auf dem Server.
    afterNextRender(
      () => {
        const target =
          document.getElementById(`antrag-${playerId}`) ??
          document.getElementById(`spieler-${playerId}`);
        if (!target) return;
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        // Ohne das wandert nur der Blick: Tastatur und Screenreader stünden
        // weiter am Seitenanfang. Das tabindex="-1" dazu steht an beiden
        // Sprungzielen im Template.
        target.focus({ preventScroll: true });
      },
      { injector: this._injector }
    );
  }

  // Voreinstellung für das aufgeklappte Antragsformular: der angesprungene
  // Spieler, sonst der erste offene Antrag der Liste. Mit Sprungziel bleibt
  // alles andere zu, auch wenn dieser Spieler hier gar keinen offenen Antrag
  // hat (dann führt der Sprung zu seiner Mannschaftszeile).
  public isInitiallyOpen(
    player: PlayerWithLicense,
    teamIndex: number,
    playerIndex: number
  ): boolean {
    if (this.focusPlayerId) return player.id === this.focusPlayerId;
    return !teamIndex && !playerIndex;
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
    // Ist der angesprungene Spieler entschieden, endet der Sprung-Zustand.
    // Sonst bliebe seine Mannschaftszeile den ganzen Besuch lang hervorgehoben
    // und isInitiallyOpen() hielte jeden verbliebenen Antrag zu, statt wie
    // bisher den nächsten aufzuklappen.
    if (playerId === this.focusPlayerId) this.focusPlayerId = undefined;
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

  // Uploadzeitpunkt einer Dokumentart. Die API setzt das Feld nur zusammen mit
  // einer abrufbaren Datei; fehlt es, bleibt es beim reinen Label.
  public docUploadedAt(
    player: PlayerWithLicense,
    docType: string
  ): string | null {
    return readUploadedAt(player.team_license?.documents, docType);
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
