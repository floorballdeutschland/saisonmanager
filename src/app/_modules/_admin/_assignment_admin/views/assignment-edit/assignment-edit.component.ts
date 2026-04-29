import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService, RefereeService } from '@floorball/core';
import {
  RefereeAssignment,
  RefereeAssignmentAvailable,
} from '@floorball/types';

@Component({
  templateUrl: './assignment-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentEditComponent implements OnInit, OnDestroy {
  assignment: RefereeAssignment | null = null;
  availableReferees: RefereeAssignmentAvailable[] = [];
  loading = false;
  saving = false;
  publishing = false;

  gameId: number | null = null;
  selectedReferee1Id: number | null = null;
  selectedReferee2Id: number | null = null;

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _notificationService: NotificationService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const param = this._route.snapshot.params['gameId'];
    if (param && param !== 'neu') {
      this.gameId = parseInt(param, 10);
      this.loading = true;
      this._refereeService
        .adminGetAssignments()
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (list) => {
            this.assignment =
              list.find((a) => a.game_id === this.gameId) ?? null;
            this.selectedReferee1Id = this.assignment?.referee1?.id ?? null;
            this.selectedReferee2Id = this.assignment?.referee2?.id ?? null;
            this.loading = false;
            this._cdr.markForCheck();
            if (this.assignment?.game?.date) {
              this._loadAvailable(this.assignment.game.date);
            }
          },
          error: () => {
            this.loading = false;
            this._cdr.markForCheck();
            this._notificationService.error(
              'Ansetzung konnte nicht geladen werden.',
              { autoClose: false, keepAfterRouteChange: false }
            );
          },
        });
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  onReferee1Change(): void {
    const r1 = this.availableReferees.find(
      (r) => r.id === this.selectedReferee1Id
    );
    if (r1?.partner_lizenznummer && !this.selectedReferee2Id) {
      const partner = this.availableReferees.find(
        (r) => r.lizenznummer === r1.partner_lizenznummer
      );
      if (partner) {
        this.selectedReferee2Id = partner.id;
        this._cdr.markForCheck();
      }
    }
  }

  save(): void {
    if (!this.gameId || !this.assignment) return;

    this.saving = true;
    const data = {
      game_id: this.gameId,
      referee1_id: this.selectedReferee1Id,
      referee2_id: this.selectedReferee2Id,
    };

    const call = this._refereeService.adminUpdateAssignment(
      this.assignment.id,
      data
    );

    call.pipe(takeUntil(this._destroy$)).subscribe({
      next: (saved) => {
        this.assignment = saved;
        this.saving = false;
        this._cdr.markForCheck();
        this._notificationService.success('Ansetzung gespeichert.', {
          autoClose: true,
          keepAfterRouteChange: false,
        });
      },
      error: (err) => {
        this.saving = false;
        this._cdr.markForCheck();
        const msg = err?.error?.errors?.[0] || 'Fehler beim Speichern.';
        this._notificationService.error(msg, {
          autoClose: false,
          keepAfterRouteChange: false,
        });
      },
    });
  }

  publish(): void {
    if (!this.assignment) return;
    this.publishing = true;
    this._refereeService
      .adminPublishAssignment(this.assignment.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (saved) => {
          this.assignment = saved;
          this.publishing = false;
          this._cdr.markForCheck();
          this._notificationService.success('Ansetzung veröffentlicht.', {
            autoClose: true,
            keepAfterRouteChange: false,
          });
        },
        error: () => {
          this.publishing = false;
          this._cdr.markForCheck();
          this._notificationService.error('Fehler beim Veröffentlichen.', {
            autoClose: false,
            keepAfterRouteChange: false,
          });
        },
      });
  }

  refereeName(r: RefereeAssignmentAvailable): string {
    return `${r.nachname}, ${r.vorname}${
      r.lizenzstufe ? ' (' + r.lizenzstufe + ')' : ''
    }`;
  }

  private _loadAvailable(date: string): void {
    this._refereeService
      .adminGetAvailableReferees(date, this.gameId ?? undefined)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (list) => {
          this.availableReferees = list;
          this._cdr.markForCheck();
        },
      });
  }
}
