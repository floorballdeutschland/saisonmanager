import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  ViewEncapsulation,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';
import { GameOperationService, NotificationService } from '@floorball/core';
import { GameOperationAdmin, StateAssociation } from '@floorball/types';
import {
  IMAGE_UPLOAD_ACCEPT,
  isAllowedImageType,
} from 'src/app/_helpers/_utils/image-upload';

// Der Abschnitt „Spielbetrieb" der Verbandsmaske.
//
// Warum als Abschnitt und nicht als eigene Maske: Ein Spielbetrieb existiert
// nicht für sich, er gehört zu genau einem Verband, und über diese Zuordnung
// entscheidet sich, für welche Vereine er zuständig ist. Zwei Menüpunkte für
// die zwei Hälften derselben Sache führten zu zwei Wahrheiten -- am
// 21.08.2026 stand am Spielbetrieb „rlpsaar" als Kürzel, am Verband „RLPSAAR".
//
// Aus derselben Überlegung fällt das Auswahlfeld „Landesverband" weg: Der
// Verband ist hier der Zusammenhang, in dem der Abschnitt steht, und kein Feld,
// das man verstellen kann. Damit entfällt auch die Frage, welche Verbände noch
// frei sind -- der eine, auf dessen Seite man gerade ist, oder keiner.
//
// Drei Lagen, und die dritte ist der Grund für den ganzen Umbau:
//
//   1. Wurzelverband MIT Spielbetrieb -> das Formular.
//   2. Wurzelverband OHNE -> ein Knopf, der ihn anlegt. Name und Kürzel kommen
//      dabei aus dem Verband, siehe _prefillFromStateAssociation.
//   3. Untergeordneter Verband -> gar kein Formular, sondern der Satz, in
//      welchem Spielbetrieb er spielt. Das ist die Auskunft, die vorher nirgends
//      stand: Hamburg ist ein eigener Verband und spielt im Spielbetrieb von
//      Schleswig-Holstein, Sachsen im Spielbetrieb SBK Ost.
@Component({
  selector: 'fb-game-operation-section',
  templateUrl: './game-operation-section.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class GameOperationSectionComponent implements OnChanges, OnDestroy {
  // Der Verband, dessen Maske den Abschnitt zeigt.
  @Input({ required: true }) stateAssociation!: Partial<StateAssociation>;
  // Für das Auflösen der Verbundwurzel bei einem untergeordneten Verband. Die
  // Verbandsmaske hat die Liste schon geladen, ein zweiter Abruf wäre Ballast.
  @Input() allStateAssociations: StateAssociation[] = [];
  // Nur bundesweite Admins (`menu_item_game_operation_admin`). Ohne das Recht
  // rendert der Abschnitt nichts und fragt vor allem nichts ab: Die API
  // antwortet auf jeden Zugriff mit 403, und der ErrorInterceptor würde den
  // Nutzer aus der Verbandsmaske werfen, die er sehr wohl sehen darf.
  @Input() canManage = false;

  loading = false;
  saving = false;
  deletingBanner = false;
  // Offenes Anlege-Formular. Getrennt von `gameOperation`, damit ein Abbruch
  // den Abschnitt zurück auf „noch keiner" stellt und nicht auf ein halb
  // gefülltes Formular.
  creating = false;
  gameOperation: Partial<GameOperationAdmin> | null = null;

  readonly acceptImageTypes = IMAGE_UPLOAD_ACCEPT;

  private readonly _maxBannerSize = 2 * 1024 * 1024;
  // Verband, fuer den schon abgerufen wurde. Ohne diese Merkung liefe der
  // Abruf bei jeder Eingabe erneut, denn ngOnChanges feuert bei jeder
  // Aenderung an einem der drei Inputs.
  private _loadedFor: number | null = null;
  private _destroy$ = new Subject<void>();

  constructor(
    private _gameOperationService: GameOperationService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  // Abgerufen wird in ngOnChanges und nicht in ngOnInit: Die Verbandsmaske
  // rendert den Abschnitt, sobald sie aus der Route weiss, dass sie im
  // Bearbeiten-Modus ist -- der Verband selbst kommt erst mit der Antwort des
  // Detail-Endpunkts hinterher, und das Recht haengt am Nutzer aus der Session.
  // In ngOnInit steht beides noch nicht fest; der Abschnitt bliebe dann fuer
  // immer bei dem leeren Verband stehen, mit dem er angelegt wurde, und meldete
  // fuer jeden Verband „noch kein Spielbetrieb".
  ngOnChanges(): void {
    const id = this.stateAssociation?.id;
    if (!this.canManage || !id || id === this._loadedFor) return;

    this._loadedFor = id;
    this._load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  // Untergeordneter Verband: Zuständig ist immer der Spielbetrieb an der Wurzel
  // des Verbandsbaums, nicht der an einem Verband darunter.
  get isSubordinate(): boolean {
    return !!this.stateAssociation?.parent_id;
  }

  // Zuerst aus dem Detail-Datensatz, erst dann aus der Liste: Beide Abrufe der
  // Verbandsmaske laufen nebeneinander, und gewinnt der Detail-Endpunkt, ist die
  // Liste noch leer -- der Satz stuende dann mit einem leeren Verbundnamen da.
  get verbundName(): string | null {
    const parentId = this.stateAssociation?.parent_id;
    if (!parentId) return null;

    return (
      this.stateAssociation.parent_name ??
      this.allStateAssociations.find((sa) => sa.id === parentId)?.name ??
      null
    );
  }

  // Vorschau der öffentlichen Adresse. Ist noch kein Pfad eingetragen, leitet
  // die API ihn aus dem Kürzel ab -- dieselbe Ableitung steht hier, damit die
  // Maske nicht erst nach dem Speichern zeigt, welche Adresse entsteht.
  get pathPreview(): string {
    const eingetragen = (this.gameOperation?.path ?? '').trim().toLowerCase();
    if (eingetragen) return eingetragen;

    return (this.gameOperation?.short_name ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Was am Spielbetrieb hängt, in Anzeigereihenfolge. Nur die Arten mit einer
  // Zahl größer null kommen in die Liste, sonst stünden dort sieben Nullen.
  //
  // Über alle Arten zu laufen statt drei davon einzeln abzufragen ist der
  // Punkt: Die API riegelt das Löschen an jeder dieser Zahlen ab, und eine hier
  // vergessene ließe die Maske „nichts hängt mehr daran" melden, während das
  // Löschen scheitert.
  get dependencyLines(): { key: string; count: number }[] {
    const d = this.gameOperation?.dependencies;
    if (!d) return [];

    return [
      { key: 'dependencyLeagues', count: d.leagues },
      { key: 'dependencyClubs', count: d.clubs },
      { key: 'dependencyUsers', count: d.users },
      { key: 'dependencyReferees', count: d.referees },
      { key: 'dependencyDocumentTypes', count: d.document_types },
      { key: 'dependencyRefereeTags', count: d.referee_tags },
      { key: 'dependencyReleases', count: d.releases },
    ].filter((line) => line.count > 0);
  }

  get hasDependencies(): boolean {
    return this.dependencyLines.length > 0;
  }

  get persisted(): boolean {
    return !!this.gameOperation?.id;
  }

  startCreate(): void {
    this.creating = true;
    this.gameOperation = this._prefillFromStateAssociation();
  }

  cancelCreate(): void {
    this.creating = false;
    this.gameOperation = null;
  }

  submit(): void {
    const go = this.gameOperation;
    if (!go?.name?.trim() || !go.short_name?.trim()) return;

    this.saving = true;

    const payload: Partial<GameOperationAdmin> = {
      name: go.name,
      short_name: go.short_name,
      // Leer mitschicken ist Absicht: Dann leitet die API den Pfad aus dem
      // Kürzel ab und speichert ihn. Den abgeleiteten Wert hier einzusetzen
      // würde ihn als eigenen Eintrag festschreiben.
      path: go.path ?? '',
      national: go.national ?? false,
      state_association_id: this.stateAssociation.id ?? null,
      banner_link_url: go.banner_link_url ?? null,
    };

    const call = go.id
      ? this._gameOperationService.adminUpdate(go.id, payload)
      : this._gameOperationService.adminCreate(payload);

    call.pipe(takeUntil(this._destroy$)).subscribe({
      next: (gespeichert) => {
        this._notificationService.success(
          this._transloco.translate(
            go.id
              ? 'gameOperationAdmin.notifications.saved'
              : 'gameOperationAdmin.notifications.created'
          ),
          { autoClose: true }
        );
        // Antwort übernehmen statt die Eingaben stehen zu lassen: Pfad und
        // Abhängigkeiten kommen von der API, der abgeleitete Pfad wäre sonst
        // erst nach einem Seitenwechsel zu sehen.
        this.gameOperation = { ...gespeichert };
        this.creating = false;
        this.saving = false;
        this._cdr.markForCheck();
      },
      // Ohne eigene Meldung: Das übernimmt der ErrorInterceptor mit dem
      // Klartext aus `errors`. Ein zweiter Toast wäre eine Dublette.
      error: () => {
        this.saving = false;
        this._cdr.markForCheck();
      },
    });
  }

  delete(): void {
    const go = this.gameOperation;
    if (!go?.id) return;

    const frage = this._transloco.translate(
      'gameOperationAdmin.section.confirmDelete',
      { name: go.name }
    );
    if (!confirm(frage)) return;

    this._gameOperationService
      .adminDelete(go.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this._notificationService.success(
            this._transloco.translate(
              'gameOperationAdmin.notifications.deleted',
              { name: go.name }
            ),
            { autoClose: true }
          );
          this.gameOperation = null;
          this._cdr.markForCheck();
        },
        // Ohne eigene Meldung: Der ErrorInterceptor zeigt den Klartext aus
        // `errors`, und genau der zählt hier -- er nennt, was noch am
        // Spielbetrieb hängt.
        error: () => undefined,
      });
  }

  onBannerSelected(input: HTMLInputElement): void {
    const id = this.gameOperation?.id;
    if (!input.files?.length || !id) return;
    const file = input.files[0];

    if (!isAllowedImageType(file)) {
      this._notificationService.error(
        this._transloco.translate(
          'gameOperationAdmin.notifications.bannerTypeError'
        ),
        { autoClose: false }
      );
      input.value = '';
      return;
    }
    if (file.size > this._maxBannerSize) {
      this._notificationService.error(
        this._transloco.translate(
          'gameOperationAdmin.notifications.bannerSizeError'
        ),
        { autoClose: false }
      );
      input.value = '';
      return;
    }

    this._gameOperationService
      .adminUploadBanner(id, file, this.gameOperation?.banner_link_url ?? null)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          input.value = '';
          if (this.gameOperation) {
            this.gameOperation.banner_url = result.banner_url;
            // Was die API zurueckmeldet, gilt: Der Link geht durch den Upload
            // hindurch, und ein stiller Verlust waere hier zu sehen.
            this.gameOperation.banner_link_url = result.banner_link_url;
          }
          this._notificationService.success(
            this._transloco.translate(
              'gameOperationAdmin.notifications.bannerUploaded'
            ),
            { autoClose: true }
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          input.value = '';
          const msg: string =
            err?.error?.message ??
            this._transloco.translate(
              'gameOperationAdmin.notifications.bannerUploadError'
            );
          this._notificationService.error(msg, { autoClose: false });
        },
      });
  }

  deleteBanner(): void {
    const id = this.gameOperation?.id;
    if (!id || this.deletingBanner) return;
    if (
      !confirm(
        this._transloco.translate(
          'gameOperationAdmin.notifications.confirmDeleteBanner'
        )
      )
    )
      return;

    this.deletingBanner = true;
    this._gameOperationService
      .adminDeleteBanner(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          if (this.gameOperation) this.gameOperation.banner_url = null;
          this.deletingBanner = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.deletingBanner = false;
          const msg: string =
            err?.error?.message ??
            this._transloco.translate(
              'gameOperationAdmin.notifications.bannerDeleteError'
            );
          this._notificationService.error(msg, { autoClose: false });
          this._cdr.markForCheck();
        },
      });
  }

  // Zwei Abrufe, weil die Auswahlliste den Spielbetrieb nur mit ID und Verband
  // führt: erst darin den zu diesem Verband finden, dann seinen vollen
  // Verwaltungsdatensatz holen (Pfad, `national`, Abhängigkeiten).
  private _load(): void {
    this.loading = true;
    this._gameOperationService
      .getAdminGameOperations()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (alle) => {
          const eigener = alle.find(
            (go) => go.state_association_id === this.stateAssociation.id
          );
          if (!eigener) {
            this.loading = false;
            this._cdr.markForCheck();
            return;
          }

          this._gameOperationService
            .adminGet(eigener.id)
            .pipe(takeUntil(this._destroy$))
            .subscribe({
              next: (go) => {
                this.gameOperation = { ...go };
                this.loading = false;
                this._cdr.markForCheck();
              },
              error: () => {
                this.loading = false;
                this._cdr.markForCheck();
              },
            });
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  // Name und Kürzel des neuen Spielbetriebs aus dem Verband vorbelegen. Das ist
  // die Regel, die der Bestand ohnehin befolgt: Bei acht von zehn
  // Spielbetrieben ist das Kürzel identisch mit dem des Landesverbands. Das
  // „e.V." fällt weg, weil kein Spielbetrieb es trägt.
  private _prefillFromStateAssociation(): Partial<GameOperationAdmin> {
    return {
      name: (this.stateAssociation.name ?? '')
        .trim()
        .replace(/\s*e\.\s*V\.$/i, '')
        .trim(),
      short_name: (this.stateAssociation.short_name ?? '').trim(),
      path: '',
      national: false,
      state_association_id: this.stateAssociation.id ?? null,
    };
  }
}
