import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

export type SystemHealthStatus = 'ok' | 'warning' | 'critical' | 'unknown';

export interface DiskUsage {
  status: SystemHealthStatus;
  reason?: string;
  path?: string;
  total_bytes?: number;
  used_bytes?: number;
  free_bytes?: number;
  used_percent?: number;
  history?: { date: string; used_percent: number }[];
}

export interface UploadKind {
  record_type: string;
  name: string;
  count: number;
  total_bytes: number;
}

export interface LargestBlob {
  filename: string;
  content_type: string | null;
  byte_size: number;
  created_at: string | null;
}

export interface MonthlyUpload {
  month: string;
  count: number;
  total_bytes: number;
}

export interface SystemHealthData {
  generated_at: string;
  status: SystemHealthStatus;
  thresholds: { warning_percent: number; critical_percent: number };
  disk: DiskUsage;
  uploads: {
    blob_count: number;
    total_bytes: number;
    unattached_count: number;
    by_kind: UploadKind[];
    largest: LargestBlob[];
  };
  database: {
    size_bytes: number | null;
    largest_tables: { name: string; total_bytes: number }[];
  };
  growth: {
    months: MonthlyUpload[];
    avg_bytes_per_month: number;
    months_until_full: number | null;
  };
  operations: {
    version: string;
    environment: string;
    pending_migrations: boolean | null;
    rails_root_path: string;
  };
}

/** Kurzfassung für den Hinweisstreifen: nur der Zustand der Platte. */
export interface SystemHealthSummary {
  status: SystemHealthStatus;
  used_percent: number | null;
  free_bytes: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class SystemHealthService {
  constructor(private http: HttpClient) {}

  getSystemHealth() {
    return this.http.get<SystemHealthData>(
      environment.apiURL + 'admin/system_health'
    );
  }

  // Bewusst ein eigener, schlanker Aufruf: Der Streifen wird bei jedem App-Start
  // eines Admins geladen und soll dafür nicht die Aufschlüsselungen und
  // Tabellengrößen mitberechnen lassen.
  getSummary() {
    return this.http.get<SystemHealthSummary>(
      environment.apiURL + 'admin/system_health/summary'
    );
  }
}
