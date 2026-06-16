import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { ArenaService, NotificationService } from '@floorball/core';
import { Arena } from '@floorball/types';

@Component({
  templateUrl: './arena-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ArenaEditComponent implements OnInit, OnDestroy {
  arena: Arena | null = null;
  isNew = true;
  saving = false;
  duplicateWarning = false;
  duplicates: Arena[] = [];

  name = '';
  city = '';
  street = '';
  housenumber = '';
  postcode = '';

  private _destroy$ = new Subject<void>();

  constructor(
    private _arenaService: ArenaService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const arenaId = this._route.snapshot.params['arenaId'];
    if (arenaId) {
      this.isNew = false;
      this._arenaService
        .getAdminArenas()
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (arenas) => {
            const found = arenas.find((a) => a.id === +arenaId);
            if (!found) {
              this._notificationService.error(
                this._transloco.translate('arena.notifications.notFound'),
                {
                  autoClose: false,
                }
              );
              this._router.navigate(['/', 'verwaltung', 'spielorte']);
              return;
            }
            this.arena = found;
            this.name = found.name;
            this.city = found.city;
            this.street = found.street ?? '';
            this.housenumber = found.housenumber ?? '';
            this.postcode = found.postcode ?? '';
            this._cdr.markForCheck();
          },
          error: () => {
            this._notificationService.error(
              this._transloco.translate('arena.notifications.loadError'),
              {
                autoClose: false,
              }
            );
            this._router.navigate(['/', 'verwaltung', 'spielorte']);
          },
        });
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  get payload(): Partial<Arena> {
    return {
      name: this.name.trim(),
      city: this.city.trim(),
      street: this.street.trim() || undefined,
      housenumber: this.housenumber.trim() || undefined,
      postcode: this.postcode.trim() || undefined,
    };
  }

  submit(force = false): void {
    this.saving = true;
    this.duplicateWarning = false;

    const obs = this.isNew
      ? this._arenaService.createArena(this.payload, force)
      : this._arenaService.updateArena(this.arena!.id, this.payload);

    obs.pipe(takeUntil(this._destroy$)).subscribe({
      next: () => {
        this.saving = false;
        this._notificationService.success(
          this._transloco.translate('arena.notifications.saved'),
          {
            autoClose: true,
            keepAfterRouteChange: true,
          }
        );
        this._router.navigate(['/', 'verwaltung', 'spielorte']);
      },
      error: (err) => {
        this.saving = false;
        if (err.status === 409 && err.error?.duplicates) {
          this.duplicateWarning = true;
          this.duplicates = err.error.duplicates;
        } else {
          this._notificationService.error(
            err.error?.errors?.join(', ') ||
              this._transloco.translate('arena.notifications.saveError'),
            { autoClose: false }
          );
        }
        this._cdr.markForCheck();
      },
    });
  }
}
