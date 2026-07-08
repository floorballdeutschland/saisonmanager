import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, take, takeUntil } from 'rxjs';
import {
  NotificationService,
  RefereeService,
  SessionService,
} from '@floorball/core';
import { RefereeAdmin } from '@floorball/types';

@Component({
  templateUrl: './referee-merge.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class RefereeMergeComponent implements OnInit, OnDestroy {
  master?: RefereeAdmin;
  secondary?: RefereeAdmin;
  searchQuery = '';
  searchResults: RefereeAdmin[] = [];
  step: 1 | 2 | 3 = 1;
  loading = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _route: ActivatedRoute,
    private _router: Router,
    private _refereeService: RefereeService,
    private _notificationService: NotificationService,
    private _sessionService: SessionService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const param: string = this._route.snapshot.params['lizenznummer'] ?? '';
    if (!param) {
      this._router.navigate(['/', 'verwaltung', 'schiedsrichter']);
      return;
    }
    this._sessionService.currentUser$
      .pipe(take(1), takeUntil(this._destroy$))
      .subscribe((user) => {
        if (!user?.permissions['referee_merge']) {
          this._router.navigate(['/', 'verwaltung', 'schiedsrichter']);
          return;
        }
        this._loadMaster(param);
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  private _loadMaster(param: string): void {
    if (param.startsWith('G-')) {
      const id = parseInt(param.slice(2), 10);
      if (!Number.isFinite(id) || id <= 0) {
        this._router.navigate(['/', 'verwaltung', 'schiedsrichter']);
        return;
      }
      this._refereeService
        .adminGetById(id)
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          // markForCheck: Die App-Root ist OnPush – eine späte HTTP-Antwort
          // stößt sonst keine Change Detection mehr an und die Seite bliebe
          // (timing-abhängig) beim @if(master)-Zustand "leer" hängen.
          next: (r) => {
            this.master = r;
            this._cdr.markForCheck();
          },
          error: () =>
            this._router.navigate(['/', 'verwaltung', 'schiedsrichter']),
        });
    } else {
      const lizenznummer = parseInt(param, 10);
      if (!Number.isFinite(lizenznummer)) {
        this._router.navigate(['/', 'verwaltung', 'schiedsrichter']);
        return;
      }
      this._refereeService
        .adminGetAll({ q: param })
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (results) => {
            const match = results.find((r) => r.lizenznummer === lizenznummer);
            if (!match) {
              this._router.navigate(['/', 'verwaltung', 'schiedsrichter']);
              return;
            }
            this._refereeService
              .adminGetById(match.id)
              .pipe(takeUntil(this._destroy$))
              .subscribe({
                next: (r) => {
                  this.master = r;
                  this._cdr.markForCheck();
                },
                error: () =>
                  this._router.navigate(['/', 'verwaltung', 'schiedsrichter']),
              });
          },
          error: () =>
            this._router.navigate(['/', 'verwaltung', 'schiedsrichter']),
        });
    }
  }

  search(): void {
    if (!this.searchQuery.trim() || !this.master) return;
    const masterId = this.master.id;
    this._refereeService
      .adminGetAll({ q: this.searchQuery })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (results) => {
          this.searchResults = results.filter((r) => r.id !== masterId);
          this._cdr.markForCheck();
        },
      });
  }

  selectSecondary(referee: RefereeAdmin): void {
    this.secondary = referee;
    this.step = 2;
  }

  confirm(): void {
    this.step = 3;
  }

  cancelConfirm(): void {
    this.step = 2;
  }

  merge(): void {
    if (!this.master || !this.secondary) return;
    this.loading = true;
    const master = this.master;
    this._refereeService
      .adminMerge(master.id, this.secondary.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this._notificationService.success(
            'Schiedsrichter erfolgreich zusammengeführt.',
            { autoClose: true, keepAfterRouteChange: true }
          );
          this._router.navigate([
            '/',
            'verwaltung',
            'schiedsrichter',
            master.lizenznummer_display,
          ]);
        },
        error: (err) => {
          this.loading = false;
          this._notificationService.error(
            err?.error?.message ?? 'Fehler beim Zusammenführen.'
          );
          this._cdr.markForCheck();
        },
      });
  }

  back(): void {
    this.step = 1;
    this.secondary = undefined;
    this.searchResults = [];
  }
}
