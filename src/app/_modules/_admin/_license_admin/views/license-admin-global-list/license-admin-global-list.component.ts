import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { AdminLicenseEntry, Season } from '@floorball/types';
import {
  AssociationService,
  LeagueService,
  NotificationService,
  PlayerService,
  SessionService,
  StorageService,
} from '@floorball/core';
import { Title } from '@angular/platform-browser';
import { Subject, finalize, take, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { downloadCsv } from 'src/app/_helpers/_utils/csv-export';
import { licenseStatusBadgeClass } from 'src/app/_helpers/_utils/license-status';
import { readUploadedAt } from '../../_utils/document-upload-date';

interface FilterOption {
  value: string | number | boolean | null;
  label: string;
}

// Statisches Altersklassen-Set entspricht dem Dropdown im Liga-Editor.
const AGE_GROUPS: string[] = [
  'U19 Junioren',
  'U17 Junioren',
  'U15 Junioren',
  'U13 Junioren',
  'U11 Junioren',
  'U9 Junioren',
  'U7 Junioren',
  'U5 Junioren',
  'U19 Juniorinnen',
  'U17 Juniorinnen',
  'U15 Juniorinnen',
  'U13 Juniorinnen',
  'U11 Juniorinnen',
  'U9 Juniorinnen',
  'U7 Juniorinnen',
  'U5 Juniorinnen',
  'Ü30',
  'Herren',
  'Damen',
];

const LEAGUE_CLASS_KEYS: { value: string; labelKey: string }[] = [
  { value: '1fbl', labelKey: 'licenseAdmin.globalList.leagueClass1fbl' },
  { value: '2fbl', labelKey: 'licenseAdmin.globalList.leagueClass2fbl' },
  { value: 'rl', labelKey: 'licenseAdmin.globalList.leagueClassRl' },
  { value: 'vl', labelKey: 'licenseAdmin.globalList.leagueClassVl' },
  { value: 'll', labelKey: 'licenseAdmin.globalList.leagueClassLl' },
];

// Auswählbare Seitengröße. Die Wahl liegt im localStorage, damit sie den
// nächsten Aufruf der Liste überlebt. Voreingestellt ist die kleinste Stufe,
// damit das Tabellenende samt waagerechter Scrollleiste ohne langes Scrollen
// erreichbar bleibt. 0 steht für "Alle": dann rendert die Tabelle die komplette
// Filtermenge auf einmal und wird mit deren Umfang langsamer, deshalb ist es
// nicht die Voreinstellung.
// Lizenz-Status (License::* auf der API-Seite): 1 erteilt, 2 beantragt,
// 3 abgelehnt, 8 zurueckgezogen.
const STATUS_REQUESTED = 2;
const STATUS_REJECTED = 3;

// Grund des Widerrufs. Er landet als Klartext in der Chronik der Lizenz und
// bleibt deshalb deutsch, unabhaengig von der Sprache der Oberflaeche – wie die
// Deaktivierungsgruende in der Vereins-Spielerliste. Uebersetzt stuende im
// Datensatz je nach Bediensprache etwas anderes.
const REVOKE_REASON = 'Ablehnung widerrufen (versehentliche Ablehnung)';

const PAGE_SIZE_ALL = 0;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, PAGE_SIZE_ALL];
const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_STORAGE_KEY = 'license_admin_page_size';

@Component({
  selector: 'fb-license-admin-global-list',
  templateUrl: './license-admin-global-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LicenseAdminGlobalListComponent implements OnInit, OnDestroy {
  readonly today = new Date().toISOString().slice(0, 10);

  allEntries: AdminLicenseEntry[] = [];
  filteredEntries: AdminLicenseEntry[] = [];
  loading = true;
  loadError = false;

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly pageSizeAll = PAGE_SIZE_ALL;
  pageSize = DEFAULT_PAGE_SIZE;
  currentPage = 1;

  gameOperationOptions: FilterOption[] = [];
  leagueOptions: FilterOption[] = [];
  ageGroupOptions: FilterOption[] = [];
  leagueClassOptions: FilterOption[] = [];
  seasonOptions: FilterOption[] = [];
  statusOptions: FilterOption[] = [];
  fieldSizeOptions: FilterOption[] = [];

  search = '';
  clubSearch = '';
  filterGameOperationId: number | null = null;
  filterLeagueId: number | null = null;
  filterFieldSize: string | null = null;
  filterFemale: boolean | null = null;
  filterAgeGroup: string | null = null;
  filterLeagueClassId: string | null = null;
  filterLeagueType: string | null = null;
  filterStatusId: number | null = null;
  filterLicenseType: string | null = null;
  // 'erstlizenz' | 'zweitlizenz' | 'none' (= ohne Zuordnung) | null (= alle)
  filterGfRole: string | null = null;
  filterExpressOnly = false;

  // Lizenz-ID der Zeile, die gerade nach Bestaetigung fragt, und die, deren
  // Widerruf laeuft. Je Lizenz und nicht je Spieler: Wer in zwei Ligen
  // abgelehnt wurde, hat zwei Zeilen, und nur eine davon ist gemeint.
  confirmRevokeLicenseId: string | null = null;
  revokingLicenseId: string | null = null;

  filterSeasonId: number | null = null;
  private _currentSeasonId: number | null = null;
  private _destroy$ = new Subject<void>();
  // Zuletzt empfangene Saisons, damit die Saison-Optionen (mit übersetztem
  // "(aktuell)"-Suffix) auch dann neu gebaut werden, wenn der Scope erst nach
  // dem synchronen seasons$-Emit geladen ist.
  private _seasons: Season[] = [];

  constructor(
    private _leagueService: LeagueService,
    private _associationService: AssociationService,
    private _playerService: PlayerService,
    private _sessionService: SessionService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title,
    private _transloco: TranslocoService,
    private _storageService: StorageService
  ) {
    this.restorePageSize();
  }

  // Eine gespeicherte Größe außerhalb der angebotenen Werte (alter Stand,
  // von Hand gesetzt) wird verworfen, statt eine krumme Seitenlänge zu zeigen.
  // Die Prüfung auf "nichts gespeichert" muss auf dem Text sitzen, nicht auf
  // der Zahl: StorageService liefert für einen fehlenden Schlüssel '', und
  // Number('') ist 0, also "Alle". Der Text '0' dagegen ist eine echte Wahl –
  // eine Prüfung wie `if (!Number(stored))` würde sie stillschweigend fallen
  // lassen.
  private restorePageSize(): void {
    const stored = this._storageService.getItem(PAGE_SIZE_STORAGE_KEY);
    if (!stored) return;

    const size = Number(stored);
    if (PAGE_SIZE_OPTIONS.includes(size)) {
      this.pageSize = size;
    }
  }

  // Titel und statische Dropdown-Labels erst bauen, wenn der (lazy geladene)
  // Scope 'admin/license' verfügbar ist – sonst würden hier die rohen Keys
  // eingefroren, weil translate() vor dem Laden nur den Key-Pfad zurückgibt.
  private buildStaticLabels(): void {
    const t = (key: string) => this._transloco.translate(key);
    this._metaTitle.setTitle(t('licenseAdmin.globalList.metaTitle'));

    this.ageGroupOptions = [
      { value: null, label: t('licenseAdmin.globalList.filterAllAgeGroups') },
      ...AGE_GROUPS.map((g) => ({ value: g, label: g })),
    ];
    this.leagueClassOptions = [
      {
        value: null,
        label: t('licenseAdmin.globalList.filterAllLeagueClasses'),
      },
      ...LEAGUE_CLASS_KEYS.map((c) => ({
        value: c.value,
        label: t(c.labelKey),
      })),
    ];
    this.statusOptions = [
      { value: null, label: t('licenseAdmin.globalList.filterAllStatuses') },
      { value: 1, label: t('licenseAdmin.globalList.statusGranted') },
      { value: 2, label: t('licenseAdmin.globalList.statusRequested') },
      { value: 3, label: t('licenseAdmin.globalList.statusRejected') },
      { value: 8, label: t('licenseAdmin.globalList.statusWithdrawn') },
    ];
    this.fieldSizeOptions = [
      { value: null, label: t('licenseAdmin.globalList.filterAllFieldSizes') },
      { value: 'GF', label: t('licenseAdmin.globalList.fieldSizeLarge') },
      { value: 'KF', label: t('licenseAdmin.globalList.fieldSizeSmall') },
    ];
    this.buildSeasonOptions(this._seasons);
    this._cdr.markForCheck();
  }

  ngOnInit(): void {
    this._sessionService.currentUser$.pipe(take(1)).subscribe((user) => {
      this.canLiftSuspension = !!(
        user?.permissions['player_suspend'] || user?.permissions['admin']
      );
      this._cdr.markForCheck();
    });

    // Warten, bis der lazy geladene Scope 'admin/license' wirklich da ist.
    // selectTranslate() lädt scope-korrekt ('admin/license/<lang>') und emittiert
    // erst nach dem Laden; selectTranslation('admin/license') dagegen fehlinterpretiert
    // den zweistufigen Pfad (Segment 'license' als Sprache) und kann vor dem Laden
    // feuern – dann würden die rohen Keys eingefroren. Der Rückgabewert ist egal.
    this._transloco
      .selectTranslate('globalList.metaTitle', {}, 'admin/license')
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.buildStaticLabels());

    this._associationService.seasons$
      .pipe(takeUntil(this._destroy$))
      .subscribe((seasons) => {
        this._seasons = seasons ?? [];
        this.buildSeasonOptions(this._seasons);
        const current = (seasons ?? []).find((s) => s.current);
        this._currentSeasonId = current?.id ?? null;
        if (this.filterSeasonId === null) {
          this.filterSeasonId = this._currentSeasonId;
          this.load();
        }
        this._cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public load(): void {
    this.loading = true;
    this.loadError = false;
    const seasonId =
      this.filterSeasonId !== null ? String(this.filterSeasonId) : undefined;
    this._leagueService.getAdminLicenses(seasonId).subscribe({
      next: (entries) => {
        this.allEntries = entries;
        this.buildFilterOptions();
        this.applyFilters();
        this.loading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
        this._cdr.markForCheck();
      },
    });
  }

  public onSeasonChange(): void {
    this.filterGameOperationId = null;
    this.filterLeagueId = null;
    this.load();
  }

  public onGameOperationChange(): void {
    this.filterLeagueId = null;
    this.buildLeagueOptions();
    this.applyFilters();
  }

  public applyFilters(): void {
    const s = this.search.toLowerCase().trim();
    const c = this.clubSearch.toLowerCase().trim();

    this.filteredEntries = this.allEntries.filter((e) => {
      if (
        s &&
        !`${e.player_last_name} ${e.player_first_name}`
          .toLowerCase()
          .includes(s)
      )
        return false;
      if (c && !(e.club_name ?? '').toLowerCase().includes(c)) return false;
      if (
        this.filterGameOperationId &&
        e.game_operation_id !== this.filterGameOperationId
      )
        return false;
      if (this.filterLeagueId && e.league_id !== this.filterLeagueId)
        return false;
      if (this.filterFieldSize && e.field_size !== this.filterFieldSize)
        return false;
      if (this.filterFemale !== null && e.female !== this.filterFemale)
        return false;
      if (this.filterAgeGroup && e.age_group !== this.filterAgeGroup)
        return false;
      if (
        this.filterLeagueClassId &&
        e.league_class_id !== this.filterLeagueClassId
      )
        return false;
      if (this.filterLeagueType && e.league_type !== this.filterLeagueType)
        return false;
      if (
        this.filterStatusId !== null &&
        e.license_status_id !== this.filterStatusId
      )
        return false;
      if (this.filterLicenseType && e.license_type !== this.filterLicenseType)
        return false;
      if (this.filterGfRole === 'none' && e.gf_role) return false;
      if (
        this.filterGfRole &&
        this.filterGfRole !== 'none' &&
        e.gf_role !== this.filterGfRole
      )
        return false;
      if (this.filterExpressOnly && !e.express) return false;
      return true;
    });
    // Nach jeder Filteränderung wieder auf Seite 1: die alte Seitenzahl liegt
    // sonst oft hinter dem Ende der neuen Treffermenge und die Tabelle wirkt leer.
    this.currentPage = 1;
  }

  // ---- Pagination ----------------------------------------------------------
  // Rein clientseitig, wie in den übrigen Admin-Listen. Die Ladezeit hängt nicht
  // an der Menge der Zeilen, sondern am Aufbau der Liste in der Schnittstelle;
  // die Seitenlänge hält allein die Zahl gerenderter Zeilen klein. Wer bewusst
  // alles auf einmal sehen will, wählt "Alle" (siehe PAGE_SIZE_ALL).

  get numberOfPages(): number {
    if (this.pageSize === PAGE_SIZE_ALL) return 1;

    return Math.max(1, Math.ceil(this.filteredEntries.length / this.pageSize));
  }

  get pagedEntries(): AdminLicenseEntry[] {
    if (this.pageSize === PAGE_SIZE_ALL) return this.filteredEntries;

    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredEntries.slice(start, start + this.pageSize);
  }

  public changePage(page: number): void {
    this.currentPage = page;
    this._cdr.markForCheck();
  }

  public changePageSize(size: number): void {
    // Die Auswahl kommt über [ngValue] als Zahl. Die Umwandlung hält den Wert
    // auch dann auf Kurs, wenn er einmal als Text ankommt: '0' === 0 ist falsch,
    // "Alle" fiele damit aus der Prüfung und würde durch 0 teilen.
    const next = Number(size);
    // Den ersten sichtbaren Eintrag mitnehmen, statt auf Seite 1 zu springen:
    // sonst verliert man beim Umschalten die Stelle in der Liste. Aus "Alle"
    // heraus gibt es keine Seitenzahl zum Mitnehmen, dort beginnt es bei 1.
    const firstIndex = (this.currentPage - 1) * this.pageSize;
    this.pageSize = next;
    this.currentPage =
      next === PAGE_SIZE_ALL ? 1 : Math.floor(firstIndex / next) + 1;
    this._storageService.setItem(PAGE_SIZE_STORAGE_KEY, String(next));
    this._cdr.markForCheck();
  }

  public resetFilters(): void {
    this.search = '';
    this.clubSearch = '';
    this.filterGameOperationId = null;
    this.filterLeagueId = null;
    this.filterFieldSize = null;
    this.filterFemale = null;
    this.filterAgeGroup = null;
    this.filterLeagueClassId = null;
    this.filterLeagueType = null;
    this.filterStatusId = null;
    this.filterLicenseType = null;
    this.filterGfRole = null;
    this.filterExpressOnly = false;
    const reloadNeeded = this.filterSeasonId !== this._currentSeasonId;
    this.filterSeasonId = this._currentSeasonId;
    if (reloadNeeded) {
      this.load();
    } else {
      this.buildLeagueOptions();
      this.applyFilters();
    }
  }

  public exportCsv(): void {
    const t = (key: string) => this._transloco.translate(key);
    const headers = [
      t('licenseAdmin.globalList.csvLastName'),
      t('licenseAdmin.globalList.csvFirstName'),
      t('licenseAdmin.globalList.csvBirthYear'),
      t('licenseAdmin.globalList.csvClub'),
      t('licenseAdmin.globalList.csvTeam'),
      t('licenseAdmin.globalList.csvGameOperation'),
      t('licenseAdmin.globalList.csvLeague'),
      t('licenseAdmin.globalList.csvStatus'),
      t('licenseAdmin.globalList.csvLicenseType'),
      t('licenseAdmin.globalList.csvGfRole'),
      t('licenseAdmin.globalList.csvExpress'),
      t('licenseAdmin.globalList.csvRequested'),
      t('licenseAdmin.globalList.csvApproved'),
    ];
    const rows = this.filteredEntries.map((e) => [
      e.player_last_name,
      e.player_first_name,
      this._safeYear(e.player_birthdate),
      e.club_name ?? '',
      e.team_name,
      e.game_operation_name ?? '',
      e.league_name,
      e.license_status,
      e.license_type === 'primary'
        ? t('licenseAdmin.globalList.csvHauptlizenz')
        : t('licenseAdmin.globalList.csvZusatzlizenz'),
      e.gf_role === 'erstlizenz'
        ? t('licenseAdmin.globalList.csvErstlizenz')
        : e.gf_role === 'zweitlizenz'
          ? t('licenseAdmin.globalList.csvZweitlizenz')
          : '',
      e.express
        ? t('licenseAdmin.globalList.csvYes')
        : t('licenseAdmin.globalList.csvNo'),
      e.requested_at ? this._formatDate(e.requested_at) : '',
      e.approved_at ? this._formatDate(e.approved_at) : '',
    ]);

    downloadCsv('lizenzen', headers, rows);
  }

  // Gemeinsam mit der Lizenzliste einer Liga, damit `gesperrt` in beiden
  // Ansichten dieselbe Farbe traegt (api#605).
  public statusBadgeClass = licenseStatusBadgeClass;

  // Sperren aufheben darf, wer sperren darf.
  public canLiftSuspension = false;

  /**
   * Sperre aufheben. Danach neu laden, statt die Zeile im Speicher zu
   * korrigieren: Der wirksame Status entsteht serverseitig je Liga, und eine
   * Sperre kann mehrere Zeilen betreffen.
   */
  public liftSuspension(entry: AdminLicenseEntry, suspensionId: number): void {
    if (!this.canLiftSuspension) return;

    this._playerService
      .liftSuspension(entry.player_id, suspensionId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this._notificationService.success(
            this._transloco.translate('licenseAdmin.globalList.liftedNotice')
          );
          this.load();
        },
        error: () => {
          // 403 und 422 zeigt der globale ErrorInterceptor nicht an.
          this._notificationService.error(
            this._transloco.translate('licenseAdmin.globalList.liftError')
          );
          this._cdr.markForCheck();
        },
      });
  }

  public fieldSizeLabel(fieldSize: string): string {
    if (fieldSize === 'GF') return 'GF';
    if (fieldSize === 'KF') return 'KF';
    return fieldSize;
  }

  public extraRequiredDocs(requiredDocuments: string[]): string[] {
    return (requiredDocuments || []).filter((d) => d !== 'parental_consent');
  }

  // Uploadzeitpunkt einer Dokumentart, damit in der Übersicht erkennbar ist,
  // was seit dem letzten Durchgang neu dazugekommen ist. Die API setzt das Feld
  // nur zusammen mit einer abrufbaren Datei; fehlt es (älterer Server, kein
  // Upload), bleibt die Anzeige beim reinen Symbol.
  public docUploadedAt(
    entry: AdminLicenseEntry,
    docType: string
  ): string | null {
    return readUploadedAt(entry.documents, docType);
  }

  public docTypeLabel(docType: string): string {
    const labels: Record<string, string> = {
      id_copy: this._transloco.translate(
        'licenseAdmin.globalList.docLabelIdCopy'
      ),
    };
    return labels[docType] ?? docType;
  }

  // Elternzustimmung verlangt die Liga, nicht das Geburtsdatum allein: Die API
  // löst beides auf (Liga-Flag bzw. eingetragene Dokumentart, Alter am Tag der
  // Beantragung) und liefert das Ergebnis in required_documents. Vorher prüfte
  // die Liste nur „minderjährig heute" und meldete die Zustimmung deshalb
  // bundesweit als fehlend, auch in Ligen ohne diese Pflicht.
  public needsParentalConsent(entry: AdminLicenseEntry): boolean {
    return !!entry.required_documents?.includes('parental_consent');
  }

  private _formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')}.${String(
      d.getMonth() + 1
    ).padStart(2, '0')}.${d.getFullYear()}`;
  }

  private _safeYear(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : d.getFullYear().toString();
  }

  private buildFilterOptions(): void {
    const goMap = new Map<number, string>();

    for (const e of this.allEntries) {
      if (e.game_operation_id)
        goMap.set(
          e.game_operation_id,
          e.game_operation_name ?? String(e.game_operation_id)
        );
    }

    this.gameOperationOptions = [
      {
        value: null,
        label: this._transloco.translate(
          'licenseAdmin.globalList.filterAllGameOperations'
        ),
      },
      ...Array.from(goMap.entries()).map(([id, name]) => ({
        value: id,
        label: name,
      })),
    ];
    this.buildLeagueOptions();
  }

  // Saison-Auswahl bewusst auf aktuelle Saison + direkte Vorsaison begrenzt.
  private buildSeasonOptions(seasons: Season[]): void {
    if (!seasons.length) {
      this.seasonOptions = [];
      return;
    }
    const sorted = [...seasons].sort((a, b) => b.id - a.id);
    const currentIdx = sorted.findIndex((s) => s.current);
    const current = currentIdx >= 0 ? sorted[currentIdx] : sorted[0];
    const previous = currentIdx >= 0 ? sorted[currentIdx + 1] : sorted[1];
    const options: FilterOption[] = [
      {
        value: current.id,
        label: this._transloco.translate(
          'licenseAdmin.globalList.seasonCurrentSuffix',
          { name: current.name }
        ),
      },
    ];
    if (previous) {
      options.push({ value: previous.id, label: previous.name });
    }
    this.seasonOptions = options;
  }

  private buildLeagueOptions(): void {
    const leagueMap = new Map<number, string>();
    for (const e of this.allEntries) {
      if (
        !this.filterGameOperationId ||
        e.game_operation_id === this.filterGameOperationId
      ) {
        leagueMap.set(e.league_id, e.league_name);
      }
    }
    // Kein Pseudo-Eintrag für „Alle Ligen": den leeren Zustand bildet das
    // Suchfeld über resetLabel ab. Ein Eintrag mit value null liesse sich nie
    // als gewählt anzeigen, weil ein leerer Wert dort „nichts gewählt" heisst.
    this.leagueOptions = Array.from(leagueMap.entries()).map(([id, name]) => ({
      value: id,
      label: name,
    }));
  }

  // ---- Ablehnung widerrufen ------------------------------------------------
  // Eine versehentliche Ablehnung war bisher endgueltig: Der Antrag fiel aus
  // der Liste der offenen Antraege, und die Entscheidungsmaske der Liga-Seite
  // rendert nur Status "beantragt". Dem Verein blieb ein neuer, kostenpflichtiger
  // Antrag. Die API laesst den Weg zurueck laengst zu (handle_license_request
  // prueft nur, dass der Status abweicht) – hier fehlte allein der Einstieg.
  //
  // Zurueck geht es nur auf "beantragt", nicht direkt auf "erteilt": Die
  // Genehmigung bleibt eine bewusste Handlung mit Gueltigkeitsdatum und
  // gegebenenfalls Erst-/Zweitlizenz-Zuordnung.

  public isRejected(entry: AdminLicenseEntry): boolean {
    return entry.license_status_id === STATUS_REJECTED;
  }

  public startRevoke(entry: AdminLicenseEntry): void {
    this.confirmRevokeLicenseId = entry.license_id;
    this._cdr.markForCheck();
  }

  public cancelRevoke(): void {
    this.confirmRevokeLicenseId = null;
    this._cdr.markForCheck();
  }

  public revokeRejection(entry: AdminLicenseEntry): void {
    // Nur der Widerruf DIESER Zeile ist gesperrt, nicht die ganze Maske: Ein
    // globaler Riegel verwarf den Klick in einer anderen Zeile stumm, waehrend
    // der Knopf dort gar nicht deaktiviert war ([disabled] vergleicht die
    // Lizenz-ID). Der zweite Klick auf dieselbe Zeile wuerde den Statuswechsel
    // nicht wiederholen (die API sieht dann keinen Unterschied mehr), aber eine
    // zweite Erfolgsmeldung erzeugen.
    if (this.revokingLicenseId === entry.license_id) return;

    // Die Liste wird einmal geladen und nicht nachgefuehrt. Wurde der Antrag in
    // der Zwischenzeit anderswo entschieden, zeigt die Zeile noch "abgelehnt",
    // und ein Widerruf setzte eine erteilte Lizenz zurueck auf "beantragt" --
    // mit dem Chronikeintrag "versehentlich abgelehnt", obwohl nichts abgelehnt
    // war. Die API prueft nur, dass der neue Status abweicht, sie kann das also
    // nicht abfangen.
    if (!this.isRejected(entry)) return;

    this.revokingLicenseId = entry.license_id;
    this._playerService
      .updateLicenseStatus(
        entry.player_id,
        entry.license_id,
        STATUS_REQUESTED,
        REVOKE_REASON
      )
      .pipe(
        takeUntil(this._destroy$),
        // Der Riegel gehoert in finalize und nicht in die Rueckrufaktionen:
        // Sonst bliebe er bei einem Abbruch durch takeUntil gesetzt, und ohne
        // Antwort waere jeder weitere Widerruf dieser Zeile bis zum Neuladen
        // ein stiller Fehlschlag.
        finalize(() => {
          this.revokingLicenseId = null;
          this._cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          entry.license_status_id = STATUS_REQUESTED;
          entry.license_status = this._transloco.translate(
            'licenseAdmin.globalList.statusRequested'
          );
          // Nur die eigene Rueckfrage schliessen: Sonst klappt die Rueckfrage
          // einer anderen Zeile zu, die waehrend des Wartens geoeffnet wurde.
          if (this.confirmRevokeLicenseId === entry.license_id) {
            this.confirmRevokeLicenseId = null;
          }
          this.reapplyFiltersKeepingPage();
          this._notificationService.success(
            this._transloco.translate(
              'licenseAdmin.notifications.rejectionRevoked',
              {
                firstName: entry.player_first_name,
                lastName: entry.player_last_name,
                id: entry.player_id,
              }
            ),
            { autoClose: true, keepAfterRouteChange: false }
          );
          this._cdr.markForCheck();
        },
        // Kein eigener error-Zweig: Der ErrorInterceptor zeigt 4xx, 5xx und
        // einen Verbindungsabbruch schon selbst an (error.interceptor.spec:
        // "shows the server message for a 422 so a component needs no own
        // toast"), eine zweite Meldung stapelte sich nur darueber. Und ohne
        // eigenen Zweig laeuft der Fehlschlag weiter in Angulars ErrorHandler,
        // wo ihn der FilteringErrorHandler an Sentry gibt -- genau die
        // Sichtbarkeit, die ein Rechte-Fehler auf diesem Weg braucht. Die
        // Rueckfrage bleibt dabei offen, der zweite Versuch geht sofort.
      });
  }

  // Die widerrufene Zeile steht jetzt auf "beantragt" und gehoert bei einem
  // Statusfilter "abgelehnt" nicht mehr in die Trefferliste. applyFilters()
  // springt dabei auf Seite 1 – die Stelle in der Liste wird deshalb
  // festgehalten und auf die neue Seitenzahl begrenzt, sonst verliert ein
  // Widerruf auf Seite 7 den Platz.
  private reapplyFiltersKeepingPage(): void {
    const page = this.currentPage;
    this.applyFilters();
    this.currentPage = Math.min(page, this.numberOfPages);
  }
}
