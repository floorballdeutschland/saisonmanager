import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { OnlineTestService } from '@floorball/core';
import { OnlineTest, OnlineTestResult } from '@floorball/types';

@Component({
  templateUrl: './online-test-results.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class OnlineTestResultsComponent implements OnInit {
  test: OnlineTest | null = null;
  results: OnlineTestResult[] = [];
  loading = true;

  constructor(
    private _route: ActivatedRoute,
    private _onlineTestService: OnlineTestService
  ) {}

  ngOnInit(): void {
    const id = +this._route.snapshot.paramMap.get('id')!;
    this._onlineTestService.adminGetResults(id).subscribe({
      next: (data) => {
        this.test = data.test;
        this.results = data.results;
        this.loading = false;
      },
    });
  }

  passedLabel(passed: boolean | null): string {
    if (passed === null) return '–';
    return passed ? 'Bestanden' : 'Nicht bestanden';
  }
}
