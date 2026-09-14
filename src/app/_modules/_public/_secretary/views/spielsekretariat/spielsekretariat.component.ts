import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import {
  GameService,
  SecretaryLicenseList,
  SecretaryPayload,
} from '@floorball/core';
import { SecretaryTokenGameDay } from '@floorball/types';

// Die Antwort wird im GameService begradigt: game_days ist dort immer gefüllt
// (auch bei einer älteren API, die nur game_day kennt) und jedes Spiel trägt
// seinen Spieltag. Diese Ansicht muss den Altfall deshalb nicht mehr kennen.
type SecretaryGameDay = SecretaryPayload;

// Derselbe Schlüssel wie im SecretaryTokenInterceptor.
const STORAGE_KEY = 'secretary_token';

// Das Alphabet aus GameDaySecretaryLink::CODE_ALPHABET (Crockford Base32, ohne
// I, L, O und U). Hier noch einmal, weil Rack::Attack vor dem Router zählt: Ein
// Vertipper, der erst am Server auffällt, verbraucht einen der zehn Versuche
// pro Minute, die sich in der Halle alle Rechner hinter einer Adresse teilen.
const CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{8}$/;

/** Die Lizenzlisten einer Liga, in der Reihenfolge der Spieltage des Links. */
interface LicenseGroup {
  leagueId: number | null;
  leagueName: string | null;
  entries: SecretaryLicenseList[];
}

@Component({
  templateUrl: './spielsekretariat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SpielSekretariatComponent implements OnInit, OnDestroy {
  data?: SecretaryGameDay;
  // Einmal nach dem Laden gebaut statt bei jedem Prüflauf: Die Ansicht steht
  // am Spieltisch stundenlang offen, und neue Objekte je Aufruf würden die
  // Tabellen bei jedem Prüflauf neu zeichnen.
  licenseGroups: LicenseGroup[] = [];
  error?: string;
  loading = true;
  token = '';
  activeTab: 'games' | 'licenses' = 'games';
  readonly today = new Date().toISOString().slice(0, 10);

  /** Eingabe des abgetippten Kurzcodes, solange kein Token vorliegt. */
  codeInput = '';
  codeError?: string;
  redeeming = false;
  showCodeForm = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _route: ActivatedRoute,
    private _gameService: GameService,
    private _cdr: ChangeDetectorRef,
    private _title: Title
  ) {
    this._title.setTitle('Spielsekretariat | Floorball Saisonmanager');
  }

  /**
   * Drei Wege auf diese Seite, in dieser Reihenfolge:
   *
   * 1. `?token=` – Links, die vor dem Kurzcode ausgegeben wurden, und der Weg,
   *    den die Spielseite zurück hierher nimmt.
   * 2. Der abgelegte Token derselben Registerkarte. Ohne ihn verlöre ein
   *    schlichtes Neuladen am Spieltisch den Zugang, und der Code müsste
   *    mitten im Spiel erneut abgetippt werden.
   * 3. Sonst die Code-Eingabe. Das ist seit fe#450 der Regelfall: Am Tisch
   *    steht ein Vereinsrechner, auf den weder Link noch Postfach kommen.
   */
  ngOnInit(): void {
    const fromUrl = this._route.snapshot.queryParamMap.get('token') ?? '';
    const token = fromUrl || this._storedToken();
    if (!token) {
      this.showCodeForm = true;
      this.loading = false;
      this._cdr.markForCheck();
      return;
    }

    this._load(token);
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  /**
   * Zurück zur Eingabe, obwohl ein Token trägt.
   *
   * `revoke_coverage_of` entwertet nur Links derselben Spieltage – der Zugang
   * von Samstag gilt am Sonntag noch. Ohne diesen Weg lädt dieselbe
   * Registerkarte kommentarlos den Spieltag von gestern, und die einzige
   * Rettung wäre, sie zu schließen. Darauf kommt am Spieltisch niemand.
   */
  enterDifferentCode(): void {
    this._clearStoredToken();
    this.data = undefined;
    this.licenseGroups = [];
    this.error = undefined;
    this.codeError = undefined;
    this.codeInput = '';
    this.token = '';
    this.showCodeForm = true;
    this._cdr.markForCheck();
  }

  /** Löst den abgetippten Code ein und lädt damit den Spieltag. */
  redeemCode(): void {
    if (this.redeeming) return;

    // Normalisiert wie `GameDaySecretaryLink.normalize_code`: Trennzeichen
    // fliegen raus, O/I/L werden zu 0/1/1. Ein Formfehler geht gar nicht erst
    // hinaus, siehe CODE_PATTERN.
    const code = this._normalizeCode(this.codeInput);
    if (!CODE_PATTERN.test(code)) {
      this.codeError =
        'Der Code besteht aus acht Zeichen (Ziffern und Buchstaben). Bitte noch einmal prüfen.';
      this._cdr.markForCheck();
      return;
    }

    this.redeeming = true;
    this.codeError = undefined;
    this._gameService
      .redeemSecretaryCode(code)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.redeeming = false;
          this.showCodeForm = false;
          this.loading = true;
          this._cdr.markForCheck();
          this._load(result.token);
        },
        // Der ErrorInterceptor lässt `public/secretary` bewusst durch, damit die
        // Meldung hier am Eingabefeld steht statt als Toast über einer leeren
        // Seite.
        error: (err) => {
          this.redeeming = false;
          this.codeError = this._redeemErrorMessage(err);
          this._cdr.markForCheck();
        },
      });
  }

  private _normalizeCode(input: string): string {
    return input
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '')
      .replace(/O/g, '0')
      .replace(/[IL]/g, '1');
  }

  /**
   * Nur die 410 heißt „falscher Code".
   *
   * Der Drossel-Responder antwortet mit `error`, nicht mit `message` – ohne
   * diese Unterscheidung las das Sekretariat bei einer 429 „Code ungültig",
   * ließ sich vom Verein einen neuen geben (was den bisherigen entwertet) und
   * lief damit in dieselbe Drossel. Aus einer Wartezeit wurde ein Ausfall.
   */
  private _redeemErrorMessage(err: {
    status?: number;
    error?: { message?: string };
  }): string {
    if (err?.status === 429) {
      return (
        'Zu viele Versuche von diesem Anschluss. Bitte eine Minute warten und ' +
        'denselben Code erneut eingeben – er gilt weiter, ein neuer Code hilft hier nicht.'
      );
    }

    if (err?.status === 410 || err?.status === 400) {
      return err?.error?.message ?? 'Der Code ist ungültig oder abgelaufen.';
    }

    return (
      `Der Code konnte gerade nicht geprüft werden (Fehler ${err?.status ?? 0}). ` +
      'Er bleibt gültig – bitte gleich noch einmal versuchen.'
    );
  }

  private _load(token: string): void {
    this.token = token;
    this._gameService
      .getSecretaryGameDay(token)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
      next: (data) => {
        this.data = data;
        // Die Meldung des vorigen Anlaufs abräumen. Ohne das stünde über dem
        // geladenen Spieltag den Rest des Tages „Der Link ist ungültig oder
        // abgelaufen." – die Ansicht widerspräche dem, was darunter steht.
        this.error = undefined;
        this.showCodeForm = false;
        // Erst ablegen, wenn der Token wirklich getragen hat. Ein abgelaufener
        // im Speicher hieße sonst: Neuladen zeigt die Fehlermeldung statt der
        // Code-Eingabe, und der Weg zurück wäre nur über einen neuen Tab.
        this._storeToken(token);
        // `loading` VOR dem Gruppenaufbau zurücksetzen: Wirft der Aufbau, trägt
        // RxJS die Ausnahme asynchron weiter und der error-Zweig unten greift
        // nicht mehr. Die Seite bliebe sonst dauerhaft im Ladezustand stehen,
        // ohne Meldung und ohne dass ein neuer Link etwas ändert.
        this.loading = false;
        this.licenseGroups = this._buildLicenseGroups(data);
        this._cdr.markForCheck();
      },
      // Nur ein totes Recht raeumt den abgelegten Token weg. Vorher tat das
      // jeder Fehler: Ein kurzer Netzaussetzer oder ein Neustart der API
      // mitten im Spiel loeschte den einzigen Zugang der Registerkarte,
      // obwohl ein zweites Neuladen ihn zurueckgeholt haette.
      //
      // err.message stammt aus normalizeSecretaryPayload und meldet eine
      // unbrauchbare Antwort. Diesen Fall nicht als abgelaufenen Link ausgeben
      // und erst recht nicht die Eingabe anbieten: Das Sekretariat ließe sich
      // sonst einen neuen Zugang geben, der genauso scheitert.
      error: (err) => {
        const gone = err?.status === 410 || err?.status === 401;
        this.error = gone
          ? (err?.error?.message ?? 'Der Link ist ungültig oder abgelaufen.')
          : ((err instanceof Error ? err.message : null) ??
            `Die Daten konnten gerade nicht geladen werden (Fehler ${
              err?.status ?? 0
            }). Der Zugang bleibt gültig – bitte die Seite neu laden.`);
        this.loading = false;
        // Wer mit einem abgelaufenen Zugang ankommt, hat den nächsten Code
        // meist schon vor sich liegen.
        this.showCodeForm = gone;
        if (gone) this._clearStoredToken();
        this._cdr.markForCheck();
      },
      });
  }

  // sessionStorage gilt je Registerkarte und ist damit genau der richtige Ort:
  // Der Zugang überlebt das Neuladen am Spieltisch, aber nicht das Schließen.
  // Derselbe Schlüssel wie im SecretaryTokenInterceptor, der ihn an jede
  // Anfrage hängt. Der Zugriff wirft im privaten Fenster und bei blockierten
  // Website-Daten; dann läuft die Seite ohne ihn weiter und der Code wird nach
  // einem Neuladen erneut abgetippt.
  private _storedToken(): string {
    try {
      if (typeof sessionStorage === 'undefined') return '';
      return sessionStorage.getItem(STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  }

  private _storeToken(token: string): void {
    try {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.setItem(STORAGE_KEY, token);
    } catch {
      // Ohne Speicher funktioniert nur das Neuladen nicht.
    }
  }

  private _clearStoredToken(): void {
    try {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // s. o.
    }
  }

  gameDays(): SecretaryTokenGameDay[] {
    return this.data?.game_days ?? [];
  }

  /** Mehrere Ligen im selben Link: dann gehört die Liga an jedes Spiel. */
  get multipleLeagues(): boolean {
    return this.gameDays().length > 1;
  }

  headerTitle(): string {
    return this.gameDays()
      .map((gd) => gd.league)
      .filter((name) => !!name)
      .join(' · ');
  }

  /** Halle des Links. Alle abgedeckten Spieltage teilen sie sich. */
  arena(): string | null {
    return this.gameDays()[0]?.arena ?? null;
  }

  date(): string | null {
    return this.gameDays()[0]?.date ?? null;
  }

  // Spielseite: /:association/:leagueId/spiel/:matchId. Verbands-Slug und
  // league_id liefert der Spieltags-Payload; fehlt eines von beiden, gibt es
  // keinen sinnvollen Pfad, und der Eintrag bleibt bewusst unverlinkt. Ein
  // Teilpfad würde auf der Verbandsroute stumm als leere Seite landen, weil
  // :association/:leagueId zwei beliebige Segmente schluckt.
  //
  // Der Link kann mehrere Ligen abdecken, deshalb wird der Spieltag des Spiels
  // gesucht statt pauschal der erste genommen – sonst landete ein Spiel der
  // zweiten Liga unter der leagueId der ersten.
  matchReportUrl(game: { id: number; game_day_id: number }): string | null {
    const day = this.gameDays().find((gd) => gd.id === game.game_day_id);
    if (!day?.game_operation_slug || !day.league_id) {
      return null;
    }

    return `/${day.game_operation_slug}/${day.league_id}/spiel/${
      game.id
    }?secretary_token=${encodeURIComponent(this.token)}`;
  }

  /** Mehrere Ligen in den Lizenzlisten: dann bekommt jede Gruppe ihre Überschrift. */
  get multipleLicenseLeagues(): boolean {
    return this.licenseGroups.length > 1;
  }

  /**
   * Lizenzlisten nach Liga gebündelt. Ein Link deckt alle Ligen einer Halle an
   * einem Tag ab; ohne die Gliederung stehen alle Mannschaften des Tages
   * hintereinander weg, quer über die Altersklassen.
   *
   * Die Reihenfolge der Gruppen stammt aus den Spieltagen des Links, die die
   * API nach Datum und Liganame sortiert. Auf die Reihenfolge der Schlüssel in
   * `license_lists` ist bewusst kein Verlass: Das ist ein Objekt mit den
   * Mannschafts-ids als Schlüssel, und JavaScript zieht zahlenartige Schlüssel
   * unabhängig von der Einfügereihenfolge nach vorn.
   *
   * Eine ältere API kennt league_id noch nicht. Dann landet alles in einer
   * namenlosen Gruppe, und die Ansicht sieht aus wie vorher.
   */
  private _buildLicenseGroups(data: SecretaryGameDay): LicenseGroup[] {
    const groups = new Map<number | null, LicenseGroup>();

    for (const day of data.game_days) {
      if (day.league_id != null && !groups.has(day.league_id)) {
        groups.set(day.league_id, {
          leagueId: day.league_id,
          leagueName: day.league ?? null,
          entries: [],
        });
      }
    }

    for (const entry of Object.values(data.license_lists ?? {})) {
      // Eine Mannschaft kann am selben Tag in derselben Halle in mehreren Ligen
      // antreten, vormittags im Ligaspiel und nachmittags im Pokal. Dann gehört
      // ihre Lizenzliste unter JEDE dieser Überschriften: Mit nur einer fehlte
      // sie unter der zweiten vollständig, und das Sekretariat des zweiten
      // Spiels suchte sie dort vergeblich.
      //
      // `leagues` liefert erst api#616. Eine ältere API kennt nur `league_id`,
      // deshalb der Rückfall darauf; kennt sie auch das nicht, landet alles in
      // einer namenlosen Gruppe und die Ansicht sieht aus wie vorher.
      const zugehoerig = entry.leagues?.length
        ? entry.leagues.map((l) => ({ id: l.id ?? null, name: l.name ?? null }))
        : [{ id: entry.league_id ?? null, name: entry.league_name ?? null }];

      for (const liga of zugehoerig) {
        let group = groups.get(liga.id);
        if (!group) {
          group = {
            leagueId: liga.id,
            leagueName: liga.name,
            entries: [],
          };
          groups.set(liga.id, group);
        }
        group.entries.push(entry);
      }
    }

    return [...groups.values()]
      .filter((group) => group.entries.length > 0)
      .map((group) => ({
        ...group,
        // `teams.name` ist in der Datenbank nullable und nur modellseitig
        // geprüft: Eine Altmannschaft ohne Namen darf den Aufbau nicht werfen.
        entries: [...group.entries].sort((a, b) =>
          (a.team_name ?? '').localeCompare(b.team_name ?? '', 'de')
        ),
      }));
  }

  /**
   * Ist diese Lizenz unter DIESER Überschrift gesperrt?
   *
   * Die Antwort nennt die betroffenen Ligen und nicht einen fertigen Status:
   * Eine Mannschaft, die vormittags in der Liga und nachmittags im Pokal
   * antritt, steht mit derselben Lizenzliste unter zwei Überschriften, und
   * eine Ligasperre gilt nur unter einer von beiden.
   */
  isSuspended(
    player: SecretaryLicenseList['players'][number],
    leagueId: number | null
  ): boolean {
    if (leagueId === null) return false;

    return (player.suspended_league_ids ?? []).includes(leagueId);
  }

  /**
   * Der Status unter DIESER Überschrift.
   *
   * `license_status` trägt die Sperre bereits, sobald sie irgendeine Liga des
   * Links erfasst — das ist die sichere Vorgabe für Leser, die nicht je
   * Überschrift unterscheiden können. Diese Ansicht kann es, und nimmt
   * deshalb den Status ohne Sperre als Grundlage: Sonst stünde eine
   * Ligasperre auch über der Pokal-Liste, in der die Lizenz weiter gilt.
   * Ältere API ohne `base_license_status`: dann bleibt es beim gelieferten.
   */
  licenseStatus(
    player: SecretaryLicenseList['players'][number],
    leagueId: number | null
  ): string {
    if (this.isSuspended(player, leagueId)) return 'gesperrt';

    return player.base_license_status ?? player.license_status;
  }

  // Die Bezeichnungen kommen aus License::NAMES, also klein geschrieben.
  // Verglichen wurde hier mit „Genehmigt"/„Beantragt" -- Schreibweisen, die
  // die API nie geschickt hat, weshalb jede Zeile in der grauen Sammelfarbe
  // landete.
  statusClass(status: string): string {
    if (status === 'erteilt') return 'text-green-700';
    if (status === 'beantragt') return 'text-yellow-700';
    if (status === 'gesperrt') return 'text-red-700 font-semibold';
    return 'text-fb-gray-400';
  }

  expiresAt(): Date | null {
    if (!this.data?.expires_at) return null;
    return new Date(this.data.expires_at);
  }
}
