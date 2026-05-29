import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  RefereeCourseImport,
  RefereeCourseImportWithResults,
  RefereeCourseMasterFields,
  RefereeCourseResult,
} from '@floorball/types';
import { environment } from 'src/environments/environment';

const BASE = environment.apiURL + 'admin/';

@Injectable({ providedIn: 'root' })
export class RefereeCourseImportService {
  constructor(private http: HttpClient) {}

  // --- Importeur ---------------------------------------------------------

  listImports() {
    return this.http.get<RefereeCourseImport[]>(
      BASE + 'referee_course_imports'
    );
  }

  getImport(id: number) {
    return this.http.get<RefereeCourseImportWithResults>(
      BASE + 'referee_course_imports/' + id
    );
  }

  uploadCsv(file: File) {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<RefereeCourseImport>(
      BASE + 'referee_course_imports',
      form
    );
  }

  cancelImport(id: number) {
    return this.http.delete<void>(BASE + 'referee_course_imports/' + id);
  }

  submitImport(id: number) {
    return this.http.post<RefereeCourseImportWithResults>(
      BASE + 'referee_course_imports/' + id + '/submit',
      {}
    );
  }

  updateResult(
    id: number,
    patch: {
      lizenzstufe?: string | null;
      gueltigkeit?: string | null;
      referee_id?: number | null;
      master_by_importer?: Partial<RefereeCourseMasterFields>;
    }
  ) {
    return this.http.patch<RefereeCourseResult>(
      BASE + 'referee_course_results/' + id,
      patch
    );
  }

  // --- LV-Reviewer -------------------------------------------------------

  listPendingResults() {
    return this.http.get<RefereeCourseResult[]>(
      BASE + 'referee_course_results'
    );
  }

  approveResult(id: number, masterFinal?: Partial<RefereeCourseMasterFields>) {
    return this.http.post<RefereeCourseResult>(
      BASE + 'referee_course_results/' + id + '/approve',
      masterFinal ? { master_final: masterFinal } : {}
    );
  }
}
