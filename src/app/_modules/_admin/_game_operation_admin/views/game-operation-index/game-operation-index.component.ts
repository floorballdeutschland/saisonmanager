import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import {
  GameOperationService,
  NotificationService,
  StateAssociationService,
} from '@floorball/core';
import { GameOperation, StateAssociation } from '@floorball/types';

@Component({
  templateUrl: './game-operation-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class GameOperationIndexComponent implements OnInit, OnDestroy {
  gameOperations: GameOperation[] = [];
  loading = false;

  // Namen der Landesverbände zum Auflösen der state_association_id. Die Liste
  // der Spielbetriebe kommt vom Auswahl-Endpunkt und trägt nur die ID; ein
  // eigener Verwaltungs-Listenendpunkt existiert bewusst nicht (siehe Service).
  private _stateAssociationNames = new Map<number, string>();

  private _destroy$ = new Subject<void>();

  constructor(
    private _gameOperationService: GameOperationService,
    private _stateAssociationService: StateAssociationService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._stateAssociationService
      .adminGetAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (all: StateAssociation[]) => {
          this._stateAssociationNames = new Map(
            all.map((sa) => [sa.id, sa.name])
          );
          this._cdr.markForCheck();
        },
      });

    this.load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this._gameOperationService
      .getAdminGameOperations()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.gameOperations = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  // Klartext des zugeordneten Landesverbands. Ohne Zuordnung ist der
  // Spielbetrieb für keinen Verein zuständig – das ist ein gültiger Zustand,
  // aber einer, der benannt gehört, statt als leere Zelle durchzugehen.
  stateAssociationName(go: GameOperation): string {
    if (!go.state_association_id) {
      return this._transloco.translate(
        'gameOperationAdmin.index.noAssociation'
      );
    }
    return (
      this._stateAssociationNames.get(go.state_association_id) ??
      `#${go.state_association_id}`
    );
  }

  delete(go: GameOperation): void {
    const frage = this._transloco.translate(
      'gameOperationAdmin.index.confirmDelete',
      { name: go.name }
    );
    if (!confirm(frage)) return;

    this._gameOperationService
      .adminDelete(go.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this._notificationService.success(
            this._transloco.translate(
              'gameOperationAdmin.notifications.deleted',
              {
                name: go.name,
              }
            ),
            { autoClose: true }
          );
          this.load();
        },
        // Ohne eigene Meldung: Der ErrorInterceptor zeigt den Klartext aus
        // `errors`, und genau der zählt hier – er nennt, wie viele Ligen,
        // Vereine und Rollen noch am Spielbetrieb hängen.
        error: () => undefined,
      });
  }
}
