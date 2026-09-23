import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { AssociationService, PlayerService } from '@floorball/core';
import { GameOperation, PlayerStats } from '@floorball/types';
import { Subject, takeUntil } from 'rxjs';

@Component({
  templateUrl: './player-stats.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PlayerStatsComponent implements OnInit, OnDestroy {
  stats?: PlayerStats;
  loading = true;
  error = false;

  private _destroy$ = new Subject<boolean>();

  // Kurzname -> Verbandspfad, nur für eindeutige Kurznamen (siehe
  // associationPath). Leer, bis init.json geantwortet hat.
  private _pathByShortName = new Map<string, string>();

  constructor(
    private _route: ActivatedRoute,
    private _playerService: PlayerService,
    private _associationService: AssociationService,
    private _cdr: ChangeDetectorRef,
    private _title: Title
  ) {}

  ngOnInit(): void {
    this._associationService.associations$
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (associations) => {
          this._pathByShortName = uniquePathsByShortName(associations);
          this._cdr.markForCheck();
        },
        // Ohne init.json bleibt der Rückfall in associationPath.
        error: () => undefined,
      });

    this._route.paramMap.pipe(takeUntil(this._destroy$)).subscribe((params) => {
      const id = Number(params.get('playerId'));
      if (!id) return;
      this.loading = true;
      this._playerService
        .getPlayerStats(id)
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (data) => {
            this.stats = data;
            this.loading = false;
            this._title.setTitle(
              `${data.player.first_name} ${data.player.last_name} – Statistiken | Floorball Saisonmanager`
            );
            this._cdr.markForCheck();
          },
          error: () => {
            this.error = true;
            this.loading = false;
            this._cdr.markForCheck();
          },
        });
    });
  }

  /**
   * Verbandspfad für den Link zur Liga.
   *
   * Die Statistik liefert je Liga nur den Kurznamen des Spielbetriebs
   * (`game_operation`), nicht dessen Pfad. Der Link baute den Pfad bisher als
   * Kurzname in Kleinbuchstaben; das trifft für „SBK Ost" (Pfad `ost`) und
   * „FLV-SH" (Pfad `flvsh`) nicht und endet seit der Verbandsprüfung am
   * Spielbetriebs-Host auf der 404-Seite. Aufgelöst wird deshalb über die
   * Spielbetriebe aus init.json. Der Kurzname ist in der API nicht eindeutig
   * validiert; bei mehrdeutigem oder unbekanntem Kurznamen bleibt es beim
   * bisherigen Rückfall.
   */
  associationPath(shortName: string): string {
    return this._pathByShortName.get(shortName) ?? shortName.toLowerCase();
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  get totalGoals(): number {
    return this.stats?.totals.goals ?? 0;
  }

  get totalAssists(): number {
    return this.stats?.totals.assists ?? 0;
  }

  get totalGames(): number {
    return this.stats?.totals.games ?? 0;
  }

  get scorerPerGame(): string {
    return this.stats?.totals.scorer_per_game.toFixed(2) ?? '0.00';
  }
}

function uniquePathsByShortName(
  associations: GameOperation[] | null | undefined
): Map<string, string> {
  const paths = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const { short_name, path } of associations ?? []) {
    if (!short_name || !path) continue;
    if (paths.has(short_name)) ambiguous.add(short_name);
    paths.set(short_name, path);
  }
  ambiguous.forEach((shortName) => paths.delete(shortName));
  return paths;
}
