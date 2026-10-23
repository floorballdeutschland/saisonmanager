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
      // Hier bewusst über den Standardfilter hinweg: Zusammenführen betrifft
      // gerade die Karriere-Beendeten, etwa wenn jemand versehentlich neu
      // angelegt wurde, statt seine alte Lizenznummer zu reaktivieren. Ohne
      // status=alle fände die Suche sie nur über die exakte Lizenznummer.
      .adminGetAll({ q: this.searchQuery, status: 'alle' })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (results) => {
          this.searchResults = results.filter((r) => r.id !== masterId);
          this._cdr.markForCheck();
        },
      });
  }

  // Wer bleibt, entscheidet die API: das Profil mit der kleinsten
  // Schiedsrichternummer (Referee.merge_roles, api#845), egal von welchem Profil
  // aus die Maske geoeffnet wurde. Die Vorschau rechnet dieselbe Regel nach,
  // damit nicht das falsche Profil als „wird behalten" dasteht.
  get kept(): RefereeAdmin | undefined {
    return this._roles()?.[0];
  }

  get dropped(): RefereeAdmin | undefined {
    return this._roles()?.[1];
  }

  // Traegt das wegfallende Profil die spaetere Lizenz, laeuft die Person
  // heute unter dessen Nummer und fuehrt danach die des behaltenen Profils.
  // Die API benennt dann das Konto um und verschickt eine Mail.
  get numberChanges(): boolean {
    const kept = this.kept;
    const dropped = this.dropped;
    if (!kept?.lizenznummer || !dropped?.lizenznummer) return false;
    if (kept.lizenznummer === dropped.lizenznummer) return false;
    if (!dropped.lizenzstufe || !dropped.gueltigkeit) return false;
    return !kept.gueltigkeit || dropped.gueltigkeit > kept.gueltigkeit;
  }

  private _roles(): [RefereeAdmin, RefereeAdmin] | undefined {
    if (!this.master || !this.secondary) return undefined;
    const mine = this.master.lizenznummer;
    const theirs = this.secondary.lizenznummer;
    if (theirs == null || (mine != null && mine <= theirs)) {
      return [this.master, this.secondary];
    }
    return [this.secondary, this.master];
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
    const expected = this.kept!;
    this._refereeService
      .adminMerge(this.master.id, this.secondary.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (res) => {
          this._notificationService.success(
            'Schiedsrichter erfolgreich zusammengeführt.',
            { autoClose: true, keepAfterRouteChange: true }
          );
          this._router.navigate([
            '/',
            'verwaltung',
            'schiedsrichter',
            res.master_lizenznummer_display ?? expected.lizenznummer_display,
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
