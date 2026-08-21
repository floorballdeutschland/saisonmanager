import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { Router } from '@angular/router';
import {
  GameOperationService,
  StateAssociationService,
  NotificationService,
  SessionService,
} from '@floorball/core';
import { GameOperation, StateAssociation, User } from '@floorball/types';

@Component({
  templateUrl: './state-association-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class StateAssociationIndexComponent implements OnInit, OnDestroy {
  stateAssociations: StateAssociation[] = [];
  sortedRows: Array<{ sa: StateAssociation; isChild: boolean }> = [];
  loading = false;
  currentUser: User | null = null;

  private _buildSortedRows(): void {
    const roots = this.stateAssociations.filter((sa) => !sa.parent_id);
    const rows: Array<{ sa: StateAssociation; isChild: boolean }> = [];
    for (const root of roots) {
      rows.push({ sa: root, isChild: false });
      for (const child of this.stateAssociations.filter(
        (sa) => sa.parent_id === root.id
      )) {
        rows.push({ sa: child, isChild: true });
      }
    }
    const listed = new Set(rows.map((r) => r.sa.id));
    for (const sa of this.stateAssociations) {
      if (!listed.has(sa.id)) rows.push({ sa, isChild: false });
    }
    this.sortedRows = rows;
  }

  private _destroy$ = new Subject<void>();

  constructor(
    private _stateAssociationService: StateAssociationService,
    private _gameOperationService: GameOperationService,
    private _notificationService: NotificationService,
    private _sessionService: SessionService,
    private _cdr: ChangeDetectorRef,
    private _router: Router
  ) {}

  get isAdmin(): boolean {
    return !!this.currentUser?.permissions['menu_item_state_association_admin'];
  }

  // Anlegen/Löschen ganzer Landesverbände bleibt echten Admins vorbehalten;
  // der globale SBK sieht zwar alle LVs, darf sie aber nicht anlegen/löschen.
  get canManageLifecycle(): boolean {
    return !!this.currentUser?.permissions[
      'state_association_manage_lifecycle'
    ];
  }

  // Der Spielbetrieb je Verband, nachgeschlagen ueber seine
  // state_association_id. Steht in der Liste, weil es die frueher eigene
  // Spielbetriebs-Uebersicht ersetzt: Der Spielbetrieb wird jetzt im Verband
  // gepflegt, und wer alle auf einmal sehen will, soll das hier tun.
  private _gameOperationsByStateAssociation = new Map<number, GameOperation>();

  // Dieselbe Grenze wie am Abschnitt in der Maske: Nur bundesweite Admins.
  // Der globale SBK bekommt vom Auswahl-Endpunkt eine nach seiner Rolle
  // gescopte Liste, die Spalte waere fuer ihn also nur halb wahr.
  get canManageGameOperation(): boolean {
    return !!this.currentUser?.permissions['menu_item_game_operation_admin'];
  }

  // Spielbetriebe ohne Verband. Sie sind fuer keinen Verein zustaendig und
  // haengen an keiner Verbandsseite -- seit der Spielbetrieb im Verband gepflegt
  // wird, waeren sie also unsichtbar. Genau das darf nicht passieren: Ein
  // Datensatz, den keine Maske mehr zeigt, ist einer, den niemand reparieren
  // kann. Am 21.08.2026 gab es auf Produktion keinen einzigen; die Zuordnung
  // eines solchen Altbestands an einen Verband bleibt Konsolenarbeit.
  orphanedGameOperations: GameOperation[] = [];

  get orphanedGameOperationNames(): string {
    return this.orphanedGameOperations
      .map((go) => go.short_name || go.name)
      .join(', ');
  }

  // Klartext fuer eine Zeile. Ein untergeordneter Verband hat keinen eigenen
  // Spielbetrieb und soll auch keinen bekommen -- zustaendig ist der an der
  // Wurzel des Verbandsbaums.
  gameOperationLabel(sa: StateAssociation): string | null {
    if (sa.parent_id) return null;

    const go = this._gameOperationsByStateAssociation.get(sa.id);
    return go ? go.short_name || go.name : null;
  }

  get isSbkOnly(): boolean {
    return (
      !!this.currentUser?.permissions['menu_item_state_association_sbk'] &&
      !this.isAdmin
    );
  }

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        this._cdr.markForCheck();
      });

    this.load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this._stateAssociationService
      .adminGetAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.stateAssociations = result;
          if (this.isSbkOnly && result.length === 1) {
            this._router.navigate([
              '/',
              'verwaltung',
              'landesverbaende',
              result[0].id,
              'bearbeiten',
            ]);
            return;
          }
          this._buildSortedRows();
          this.loading = false;
          this._loadGameOperations();
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  // Erst nach den Verbaenden und nur mit Recht: Ohne das Recht antwortet der
  // Endpunkt gescopt statt vollstaendig, und die Spalte wird ohnehin nicht
  // gerendert.
  private _loadGameOperations(): void {
    if (!this.canManageGameOperation) return;

    this._gameOperationService
      .getAdminGameOperations()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (alle) => {
          this._gameOperationsByStateAssociation = new Map(
            alle
              .filter((go) => !!go.state_association_id)
              .map((go) => [go.state_association_id as number, go])
          );
          this.orphanedGameOperations = alle.filter(
            (go) => !go.state_association_id
          );
          this._cdr.markForCheck();
        },
      });
  }

  delete(sa: StateAssociation): void {
    if (!confirm(`Landesverband "${sa.name}" wirklich löschen?`)) return;

    this._stateAssociationService
      .adminDelete(sa.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this._notificationService.success(`"${sa.name}" gelöscht.`, {
            autoClose: true,
          });
          this.load();
        },
        error: () => {
          this._notificationService.error('Fehler beim Löschen.', {
            autoClose: false,
          });
        },
      });
  }
}
