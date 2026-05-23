import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

export interface DailyCount {
  date: string;
  count: number;
}

export interface MonthlyCount {
  month: string;
  count: number;
}

export interface AnalyticsData {
  last_30_days: DailyCount[];
  last_year: MonthlyCount[];
}

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  constructor(private http: HttpClient) {}

  getAnalytics() {
    return this.http.get<AnalyticsData>(environment.apiURL + 'admin/analytics');
  }
}
