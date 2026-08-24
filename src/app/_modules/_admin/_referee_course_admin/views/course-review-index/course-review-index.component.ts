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
  ClubService,
  NotificationService,
  RefereeCourseImportService,
} from '@floorball/core';
import {
  Club,
  RefereeCourseMasterFields,
  RefereeCourseResult,
} from '@floorball/types';

/**
 * Die sechs Merkmale, aus denen sich der Match-Score einer Zeile zusammensetzt.
 * `club` steht bewusst neben den Master-Feldern und nicht fuer `club_id`: Auf
 * der CSV-Seite ist der Verein ein Name, auf der Datenbankseite eine Referenz.
 */
export type ReviewField =
  | 'lizenznummer'
  | 'vorname'
  | 'nachname'
  | 'geburtsdatum'
  | 'email'
  | 'club';

@Component({
  templateUrl: './course-review-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CourseReviewIndexComponent implements OnInit, OnDestroy {
  results: RefereeCourseResult[] = [];
  loading = false;
  // Pro Result lokaler Edit-Buffer für Stammdaten (Master-Final).
  editBuffers = new Map<number, Partial<RefereeCourseMasterFields>>();
  approving = new Set<number>();
  /** Flache, alphabetisch sortierte Vereinsliste für die Vereinsauswahl. */
  clubs: Club[] = [];

  readonly reviewFields: ReviewField[] = [
    'lizenznummer',
    'vorname',
    'nachname',
    'geburtsdatum',
    'email',
    'club',
  ];

  /**
   * Abweichende Merkmale je Zeile. Der Vergleich betrifft nur Datei gegen
   * Datenbank — beides ändert sich erst beim nächsten Laden, das Bearbeiten
   * der Spalte „Final“ berührt ihn nicht. Deshalb einmal rechnen statt in
   * jedem Change-Detection-Zyklus sechs Vergleiche pro Zeile.
   */
  private _differingFields = new Map<number, ReviewField[]>();

  private _destroy$ = new Subject<void>();

  constructor(
    private _service: RefereeCourseImportService,
    private _clubService: ClubService,
    private _notify: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadClubs();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this._service
      .listPendingResults()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.results = result;
          this.editBuffers.clear();
          this._differingFields.clear();
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this._notify.error(
            err?.error?.error ??
              this._transloco.translate(
                'refereeCourseAdmin.notifications.loadPendingError'
              )
          );
          this._cdr.markForCheck();
        },
      });
  }

  /**
   * Vereine für die Auswahl in der Spalte „Übernehmen“. Die Freigabe darf den
   * Verein setzen, gerade weil der Abgleich beim Import nur exakte Namen trifft
   * — „Unihockeyverein X e.V.“ in der Datei findet den Verein „UV X“ nicht.
   *
   * Ein Fehler hier macht die Maske nicht unbenutzbar: Alle anderen Merkmale
   * bleiben bearbeitbar, nur die Vereinsauswahl bleibt leer. Deshalb eine
   * Meldung statt eines stillen Fehlschlags, aber kein Abbruch des Ladens.
   */
  loadClubs(): void {
    this._clubService
      .getAdminClubs()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (groups) => {
          this.clubs = groups
            .flatMap((group) => group.clubs ?? [])
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
          this._cdr.markForCheck();
        },
        error: () => {
          this._notify.error(
            this._transloco.translate(
              'refereeCourseAdmin.notifications.loadClubsError'
            )
          );
          this._cdr.markForCheck();
        },
      });
  }

  /** Wert aus der importierten Datei. */
  csvValue(result: RefereeCourseResult, field: ReviewField): unknown {
    if (field === 'club') return result.csv.verein ?? null;
    return result.csv[field];
  }

  /** Wert, der aktuell beim Schiedsrichter in der Datenbank steht. */
  dbValue(result: RefereeCourseResult, field: ReviewField): unknown {
    const snapshot = result.referee_snapshot;
    if (!snapshot) return null;
    if (field === 'club') return snapshot.club_name ?? null;
    return snapshot[field] ?? null;
  }

  /**
   * Weicht das Merkmal zwischen Datei und Datenbank ab?
   *
   * Gleiche Regel wie der Match-Score der API: Ein auf einer Seite leeres Feld
   * zählt als Treffer und wird hier deshalb nicht als Abweichung markiert —
   * sonst stünde die Zahl im Kopf der Zeile im Widerspruch zu den Markierungen.
   *
   * Der Verein wird über die Referenz verglichen, nicht über den Namen: Die
   * Datei schreibt ihn aus, die Datenbank führt die Kurzform. Verglichen wird
   * daher der beim Import zugeordnete Verein mit dem des Schiedsrichters.
   */
  fieldsDiffer(result: RefereeCourseResult, field: ReviewField): boolean {
    if (field === 'club') return this._clubDiffers(result);

    const csv = this.csvValue(result, field);
    const db = this.dbValue(result, field);
    if (csv == null || csv === '') return false;
    if (db == null || db === '') return false;
    return String(csv).toLowerCase() !== String(db).toLowerCase();
  }

  /**
   * Der Verein aus der Datei ließ sich keinem Verein zuordnen. Das ist keine
   * Abweichung zwischen zwei Werten, sondern ein fehlender Treffer — und der
   * häufigste Grund für einen Teilmatch, weil der Abgleich den Namen exakt
   * nimmt. Die Maske sagt das deshalb ausdrücklich.
   */
  clubUnmatched(result: RefereeCourseResult): boolean {
    return !!result.csv.verein && !result.matched_club;
  }

  /**
   * Welche der sechs Merkmale weichen ab? Trägt die Legende über der Tabelle
   * und beantwortet damit die Frage, ob es an dieser Zeile überhaupt etwas zu
   * prüfen gibt — die Markierung an der Zeile sagt dann, wo.
   */
  differingFields(result: RefereeCourseResult): ReviewField[] {
    const cached = this._differingFields.get(result.id);
    if (cached) return cached;

    const fields = this.reviewFields.filter((field) =>
      this.fieldsDiffer(result, field)
    );
    this._differingFields.set(result.id, fields);
    return fields;
  }

  private _clubDiffers(result: RefereeCourseResult): boolean {
    const csvClub = result.csv.verein;
    const refereeClubId = result.referee_snapshot?.club_id ?? null;
    if (!csvClub) return false;
    if (refereeClubId == null) return false;
    // Nicht zuordenbarer Vereinsname zählt beim Score als Nicht-Treffer.
    if (!result.matched_club) return true;
    return result.matched_club.id !== refereeClubId;
  }

  /** Aktuell gewählter Verein der Zeile — Edit-Buffer schlägt den Serverwert. */
  selectedClubId(result: RefereeCourseResult): number | null {
    const buffered = this.editBuffers.get(result.id);
    if (buffered && 'club_id' in buffered) return buffered.club_id ?? null;
    return result.master.club_id ?? null;
  }

  bufferFor(id: number): Partial<RefereeCourseMasterFields> {
    if (!this.editBuffers.has(id)) this.editBuffers.set(id, {});
    return this.editBuffers.get(id)!;
  }

  setField<K extends keyof RefereeCourseMasterFields>(
    result: RefereeCourseResult,
    field: K,
    value: RefereeCourseMasterFields[K]
  ): void {
    const buf = this.bufferFor(result.id);
    buf[field] = value;
  }

  approve(result: RefereeCourseResult): void {
    const buf = this.editBuffers.get(result.id);
    this.approving.add(result.id);

    this._service
      .approveResult(
        result.id,
        buf && Object.keys(buf).length ? buf : undefined
      )
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.results = this.results.filter((r) => r.id !== result.id);
          this.editBuffers.delete(result.id);
          this.approving.delete(result.id);
          this._notify.success(
            this._transloco.translate(
              'refereeCourseAdmin.notifications.approved'
            )
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.approving.delete(result.id);
          this._notify.error(
            err?.error?.error ??
              this._transloco.translate(
                'refereeCourseAdmin.notifications.approveFailed'
              )
          );
          this._cdr.markForCheck();
        },
      });
  }

  trackResult(_: number, r: RefereeCourseResult): number {
    return r.id;
  }
}
