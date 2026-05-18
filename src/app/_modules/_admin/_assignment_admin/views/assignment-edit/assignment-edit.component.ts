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
import { NotificationService, RefereeService } from '@floorball/core';
import {
  RefereeAssignableGame,
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
  gameInfo: RefereeAssignableGame | null = null;
  availableReferees: RefereeAssignmentAvailable[] = [];
  loading = false;
  saving = false;
  publishing = false;

  gameId: number | null = null;
  selectedReferee1Id: number | null = null;
  selectedReferee2Id: number | null = null;

  referee1Query = '';
  referee2Query = '';
  showReferee1Dropdown = false;
  showReferee2Dropdown = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _notificationService: NotificationService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const param = this._route.snapshot.params['gameId'];
    if (param && param !== 'neu') {
      this.gameId = parseInt(param, 10);
      this.loading = true;

      // Game info may be passed via router state when navigating from the games list
      const navState = this._router.lastSuccessfulNavigation?.extras?.state as {
        game?: RefereeAssignableGame;
      } | null;
      if (navState?.game) {
        this.gameInfo = navState.game;
      }

      this._refereeService
        .adminGetAssignments()
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (list) => {
            this.assignment =
              list.find((a) => a.game_id === this.gameId) ?? null;
            this.selectedReferee1Id = this.assignment?.referee1?.id ?? null;
            this.selectedReferee2Id = this.assignment?.referee2?.id ?? null;
            if (this.assignment?.referee1) {
              this.referee1Query = this._stubName(this.assignment.referee1);
            }
            if (this.assignment?.referee2) {
              this.referee2Query = this._stubName(this.assignment.referee2);
            }
            this.loading = false;
            this._cdr.markForCheck();
            const date =
              this.assignment?.game?.date ?? this.gameInfo?.date ?? null;
            if (date) {
              this._loadAvailable(date);
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

  get displayGame(): RefereeAssignment['game'] | RefereeAssignableGame | null {
    return this.assignment?.game ?? this.gameInfo ?? null;
  }

  filteredReferees(query: string): RefereeAssignmentAvailable[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.availableReferees.filter(
      (r) =>
        r.vorname.toLowerCase().includes(q) ||
        r.nachname.toLowerCase().includes(q)
    );
  }

  selectReferee1(r: RefereeAssignmentAvailable): void {
    this.selectedReferee1Id = r.id;
    this.referee1Query = this.refereeName(r);
    this.showReferee1Dropdown = false;
    this._cdr.markForCheck();
    this._autoFillPartner(r);
  }

  selectReferee2(r: RefereeAssignmentAvailable): void {
    this.selectedReferee2Id = r.id;
    this.referee2Query = this.refereeName(r);
    this.showReferee2Dropdown = false;
    this._cdr.markForCheck();
  }

  clearReferee1(): void {
    this.selectedReferee1Id = null;
    this.referee1Query = '';
    this.showReferee1Dropdown = false;
    this._cdr.markForCheck();
  }

  clearReferee2(): void {
    this.selectedReferee2Id = null;
    this.referee2Query = '';
    this.showReferee2Dropdown = false;
    this._cdr.markForCheck();
  }

  onReferee1Blur(): void {
    setTimeout(() => {
      this.showReferee1Dropdown = false;
      if (!this.selectedReferee1Id) {
        this.referee1Query = '';
      } else {
        const r = this.availableReferees.find(
          (x) => x.id === this.selectedReferee1Id
        );
        if (r) this.referee1Query = this.refereeName(r);
      }
      this._cdr.markForCheck();
    }, 200);
  }

  onReferee2Blur(): void {
    setTimeout(() => {
      this.showReferee2Dropdown = false;
      if (!this.selectedReferee2Id) {
        this.referee2Query = '';
      } else {
        const r = this.availableReferees.find(
          (x) => x.id === this.selectedReferee2Id
        );
        if (r) this.referee2Query = this.refereeName(r);
      }
      this._cdr.markForCheck();
    }, 200);
  }

  onReferee1Input(value: string): void {
    this.referee1Query = value;
    this.selectedReferee1Id = null;
    this.showReferee1Dropdown = value.trim().length > 0;
    this._cdr.markForCheck();
  }

  onReferee2Input(value: string): void {
    this.referee2Query = value;
    this.selectedReferee2Id = null;
    this.showReferee2Dropdown = value.trim().length > 0;
    this._cdr.markForCheck();
  }

  private _autoFillPartner(r1: RefereeAssignmentAvailable): void {
    if (r1.partner_lizenznummer && !this.selectedReferee2Id) {
      const partner = this.availableReferees.find(
        (r) => r.lizenznummer === r1.partner_lizenznummer
      );
      if (partner) {
        this.selectedReferee2Id = partner.id;
        this.referee2Query = this.refereeName(partner);
        this._cdr.markForCheck();
      }
    }
  }

  private _stubName(stub: {
    vorname: string;
    nachname: string;
    lizenzstufe?: string;
  }): string {
    return `${stub.nachname}, ${stub.vorname}${
      stub.lizenzstufe ? ' (' + stub.lizenzstufe + ')' : ''
    }`;
  }

  save(): void {
    if (!this.gameId) return;

    this.saving = true;
    const data = {
      game_id: this.gameId,
      referee1_id: this.selectedReferee1Id,
      referee2_id: this.selectedReferee2Id,
    };

    const call = this.assignment
      ? this._refereeService.adminUpdateAssignment(this.assignment.id, data)
      : this._refereeService.adminCreateAssignment(data);

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
