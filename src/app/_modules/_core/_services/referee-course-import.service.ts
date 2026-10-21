import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  RefereeCourseImport,
  RefereeCourseImportWithResults,
  RefereeCourseMasterFields,
  RefereeCourseResult,
  RefereeCourseProcessSettings,
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

  /**
   * Reicht ohne `resultIds` alle nicht zurückgestellten Zeilen ein, sonst nur
   * die genannten (alles oder nichts). Die Antwort trägt den Import **ohne**
   * seine Zeilen (`full_hash`), der Aufrufer lädt danach neu.
   */
  submitImport(id: number, resultIds?: number[]) {
    return this.http.post<
      RefereeCourseImport & {
        license_notifications?: number;
        license_notifications_unreachable?: number;
      }
    >(
      BASE + 'referee_course_imports/' + id + '/submit',
      resultIds ? { result_ids: resultIds } : {}
    );
  }

  updateResult(
    id: number,
    patch: {
      lizenzstufe?: string | null;
      gueltigkeit?: string | null;
      referee_id?: number | null;
      deferred?: boolean;
      master_by_importer?: Partial<RefereeCourseMasterFields>;
    }
  ) {
    return this.http.patch<RefereeCourseResult>(
      BASE + 'referee_course_results/' + id,
      patch
    );
  }

  /**
   * Verwirft eine noch nicht eingereichte Zeile — die Doppelmeldung, die
   * zurückgezogene Teilnahme. Angewendet wurde für sie nichts.
   */
  discardResult(id: number) {
    return this.http.post<RefereeCourseResult>(
      BASE + 'referee_course_results/' + id + '/discard',
      {}
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

  // --- Schalter (Schiri-Einstellungen, nur Admin) ------------------------

  getProcessSettings() {
    return this.http.get<RefereeCourseProcessSettings>(
      BASE + 'referee_course_settings'
    );
  }

  updateProcessSettings(settings: Partial<RefereeCourseProcessSettings>) {
    return this.http.patch<RefereeCourseProcessSettings>(
      BASE + 'referee_course_settings',
      { referee_course_settings: settings }
    );
  }
}
