import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  NotificationService,
  OnlineTestService,
  RefereeService,
} from '@floorball/core';
import {
  OnlineTest,
  OnlineTestAssignment,
  RefereeAdmin,
} from '@floorball/types';

@Component({ templateUrl: './online-test-assignments.component.html' })
export class OnlineTestAssignmentsComponent implements OnInit {
  test: OnlineTest | null = null;
  assignments: OnlineTestAssignment[] = [];
  searchQuery = '';
  searchResults: RefereeAdmin[] = [];
  searching = false;

  constructor(
    private _route: ActivatedRoute,
    private _onlineTestService: OnlineTestService,
    private _refereeService: RefereeService,
    private _notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    const id = +this._route.snapshot.paramMap.get('id')!;
    this._onlineTestService
      .adminGet(id)
      .subscribe({ next: (t) => (this.test = t) });
    this._onlineTestService
      .adminGetAssignments(id)
      .subscribe({ next: (a) => (this.assignments = a) });
  }

  search(): void {
    if (!this.searchQuery.trim()) return;
    this.searching = true;
    this._refereeService.adminGetAll({ q: this.searchQuery }).subscribe({
      next: (refs) => {
        this.searchResults = refs;
        this.searching = false;
      },
    });
  }

  assign(refereeId: number): void {
    if (!this.test) return;
    this._onlineTestService
      .adminCreateAssignment(this.test.id, refereeId)
      .subscribe({
        next: (a) => {
          this.assignments = [...this.assignments, a];
          this.searchResults = this.searchResults.filter(
            (r) => r.id !== refereeId
          );
          this._notificationService.success('Schiedsrichter zugewiesen.', {
            autoClose: true,
          });
        },
        error: () =>
          this._notificationService.error('Zuweisung fehlgeschlagen.', {
            autoClose: false,
          }),
      });
  }

  remove(assignmentId: number): void {
    if (!this.test) return;
    if (!confirm('Zuweisung wirklich entfernen?')) return;
    this._onlineTestService
      .adminDeleteAssignment(this.test.id, assignmentId)
      .subscribe({
        next: () => {
          this.assignments = this.assignments.filter(
            (a) => a.id !== assignmentId
          );
          this._notificationService.success('Zuweisung entfernt.', {
            autoClose: true,
          });
        },
        error: () =>
          this._notificationService.error('Entfernen fehlgeschlagen.', {
            autoClose: false,
          }),
      });
  }

  isAssigned(refereeId: number): boolean {
    return this.assignments.some((a) => a.referee_id === refereeId);
  }
}
