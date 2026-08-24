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
   * Verein setzen, gerade weil der Abgleich beim Import nur exakte Namen
   * trifft: Der ausgeschriebene Name aus der Datei findet die Kurzform in der
   * Datenbank nicht.
   *
   * Bewusst `getAdminClubAll` und nicht `getAdminClubs`: Letzteres wertet nur
   * Admin- und SBK-Rechte aus und antwortet einem reinen LV-RSK mit einer
   * leeren Liste und Status 200. Genau der ist aber die Zielgruppe dieser
   * Maske, die Auswahl wäre für ihn immer leer, ohne dass ein Fehlerzweig
   * anspringt. Deaktivierte Vereine kommen mit, damit ein Schiedsrichter in
   * einem Bestandsverein seinen gespeicherten Verein behält statt ihn
   * unbenannt zu verlieren.
   *
   * Ein Fehler hier macht die Maske nicht unbenutzbar: Alle anderen Merkmale
   * bleiben bearbeitbar. Die Vereinsauswahl wird dann gesperrt (siehe
   * `clubsUnavailable`), damit niemand einen Verein aus einer leeren Liste
   * heraus versehentlich entfernt.
   */
  loadClubs(): void {
    this._clubService
      .getAdminClubAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (clubs) => {
          this.clubs = [...clubs].sort((a, b) =>
            (a.name ?? '').localeCompare(b.name ?? '')
          );
          this._cdr.markForCheck();
        },
        error: () => {
          this.clubs = [];
          this._notify.error(
            this._transloco.translate(
              'refereeCourseAdmin.notifications.loadClubsError'
            )
          );
          this._cdr.markForCheck();
        },
      });
  }

  /**
   * Ohne Vereinsliste wird die Auswahl gesperrt. Sonst steht dort ein Feld,
   * dessen einziger erreichbarer Eintrag „kein Verein“ ist: Ein Enter darin
   * schreibt `club_id: null` in den Puffer, die Freigabe entfernt den Verein
   * beim Schiedsrichter, und weil das Feld leer aussieht wie zuvor, ist der
   * Unterschied nicht zu sehen.
   */
  get clubsUnavailable(): boolean {
    return this.clubs.length === 0;
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

    // `trim` wie `RefereeCourseResult.field_match?` in der API (dort `strip` vor
    // `casecmp`): Ein Randleerzeichen ergäbe sonst hier eine Markierung, die
    // der Score nicht kennt. Bestandsdaten mit Namensrändern gibt es.
    const csv = String(this.csvValue(result, field) ?? '').trim();
    const db = String(this.dbValue(result, field) ?? '').trim();
    if (!csv || !db) return false;
    return csv.toLowerCase() !== db.toLowerCase();
  }

  /**
   * Der Vereinsname aus der Datei ließ sich keinem Verein zuordnen. Das ist
   * keine Abweichung zwischen zwei Werten, sondern ein fehlender Treffer, und
   * der häufigste Grund für einen Teilmatch, weil der Abgleich den Namen exakt
   * nimmt. Die Maske sagt das deshalb ausdrücklich.
   *
   * Maßgeblich ist `csv_club_match` und nicht `matched_club`: Letzteres fällt
   * beim Import auf den Verein des Schiedsrichters zurück, wenn der Name nicht
   * trifft, und meldete damit ausgerechnet für diesen Fall einen Treffer.
   */
  clubUnmatched(result: RefereeCourseResult): boolean {
    return !!result.csv.verein && !result.csv_club_match;
  }

  /**
   * Welche der sechs Merkmale weichen ab? Trägt die Legende über der Tabelle
   * und beantwortet damit die Frage, ob es an dieser Zeile überhaupt etwas zu
   * prüfen gibt; die Markierung an der Zeile sagt dann, wo.
   */
  differingFields(result: RefereeCourseResult): ReviewField[] {
    return this.reviewFields.filter((field) =>
      this.fieldsDiffer(result, field)
    );
  }

  /**
   * Spiegelt die Vereinsregel des Match-Scores der API
   * (`count_csv_to_referee_matches`): Ist der Name in der Datei leer oder hat
   * der Schiedsrichter keinen Verein, zählt das als Treffer. Sonst muss der
   * Namenstreffer genau sein Verein sein.
   */
  private _clubDiffers(result: RefereeCourseResult): boolean {
    const csvClub = result.csv.verein;
    const refereeClubId = result.referee_snapshot?.club_id ?? null;
    if (!csvClub) return false;
    if (refereeClubId == null) return false;
    // Kein Namenstreffer heißt beim Score Nicht-Treffer.
    if (!result.csv_club_match) return true;
    return result.csv_club_match.id !== refereeClubId;
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
          // Kein eigener Toast: Der ErrorInterceptor meldet 4xx bereits mit
          // demselben Text aus `error.error`, und die Meldungen bleiben ohne
          // Routenwechsel stehen. Ein zweiter Aufruf legte pro Klick eine
          // doppelte, einzeln wegzuklickende Meldung übereinander.
          //
          // Beim 422 des Import-Guards steht die Zeile nur noch in dieser
          // Maske und nicht mehr in der Warteschlange: neu laden, damit der
          // Bildschirm nicht weiter etwas zum Freigeben behauptet.
          if (err?.status === 422) this.load();
          this._cdr.markForCheck();
        },
      });
  }

  trackResult(_: number, r: RefereeCourseResult): number {
    return r.id;
  }
}
