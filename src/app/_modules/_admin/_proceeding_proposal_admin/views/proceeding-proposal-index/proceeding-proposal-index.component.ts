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
  ProceedingProposalService,
  NotificationService,
} from '@floorball/core';
import { ProceedingProposal } from '@floorball/types';

@Component({
  templateUrl: './proceeding-proposal-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ProceedingProposalIndexComponent implements OnInit, OnDestroy {
  proposals: ProceedingProposal[] = [];
  loading = false;
  // Aufgeklappte Zeile: hält das vollständige Detail (inkl. report.url),
  // das separat per get(id) nachgeladen wird.
  expandedId: number | null = null;
  detail: ProceedingProposal | null = null;
  loadingDetail = false;
  processingIds = new Set<number>();

  private _destroy$ = new Subject<void>();

  constructor(
    private _proceedingProposalService: ProceedingProposalService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this._proceedingProposalService
      .getAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.proposals = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._notificationService.error(
            this._transloco.translate(
              'proceedingProposalAdmin.notifications.loadError'
            ),
            { autoClose: false }
          );
          this._cdr.markForCheck();
        },
      });
  }

  toggle(proposal: ProceedingProposal): void {
    if (this.expandedId === proposal.id) {
      this.expandedId = null;
      this.detail = null;
      return;
    }
    this.expandedId = proposal.id;
    this.detail = null;
    this.loadingDetail = true;
    this._proceedingProposalService
      .get(proposal.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (detail) => {
          this.detail = detail;
          this.loadingDetail = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loadingDetail = false;
          this._notificationService.error(
            this._transloco.translate(
              'proceedingProposalAdmin.notifications.detailError'
            ),
            { autoClose: false }
          );
          this._cdr.markForCheck();
        },
      });
  }

  open(proposal: ProceedingProposal): void {
    if (this.processingIds.has(proposal.id)) return;
    this.processingIds.add(proposal.id);
    this._proceedingProposalService
      .open(proposal.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.processingIds.delete(proposal.id);
          this._notificationService.success(
            this._transloco.translate(
              'proceedingProposalAdmin.notifications.opened'
            ),
            { autoClose: true }
          );
          this._remove(proposal.id);
          this._cdr.markForCheck();
        },
        error: () => {
          this.processingIds.delete(proposal.id);
          this._cdr.markForCheck();
        },
      });
  }

  reject(proposal: ProceedingProposal): void {
    if (this.processingIds.has(proposal.id)) return;
    this.processingIds.add(proposal.id);
    this._proceedingProposalService
      .reject(proposal.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.processingIds.delete(proposal.id);
          this._notificationService.success(
            this._transloco.translate(
              'proceedingProposalAdmin.notifications.rejected'
            ),
            { autoClose: true }
          );
          this._remove(proposal.id);
          this._cdr.markForCheck();
        },
        error: () => {
          this.processingIds.delete(proposal.id);
          this._cdr.markForCheck();
        },
      });
  }

  private _remove(id: number): void {
    this.proposals = this.proposals.filter((p) => p.id !== id);
    if (this.expandedId === id) {
      this.expandedId = null;
      this.detail = null;
    }
  }
}
