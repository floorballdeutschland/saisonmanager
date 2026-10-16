import { StorageService } from '@floorball/core';
import { ShotInput } from '@floorball/types';

interface BufferState {
  upserts: ShotInput[];
  deletes: string[];
}

const KEY_PREFIX = 'tablet_shot_buffer_';

/**
 * Lokaler Puffer der Schüsse eines Spiels, die der Server noch nicht bestätigt
 * hat (fe#344).
 *
 * Jeder Schuss landet zuerst hier und erst danach im Netz. So geht am
 * Spielfeldrand nichts verloren, wenn das WLAN wegbricht oder die Seite neu
 * geladen wird. Gesendet wird immer der ganze Puffer; der Server arbeitet
 * idempotent über `client_uuid`, ein doppelt gesendeter Schuss überschreibt
 * sich also nur selbst.
 *
 * Bestätigt wird ein Schuss nur, wenn er seit dem Absenden nicht geändert
 * wurde: Wer während einer laufenden Übertragung korrigiert, verliert die
 * Korrektur sonst an die ältere Fassung.
 */
export class ShotBuffer {
  private readonly _key: string;
  private _state: BufferState;

  // Zählt jede Änderung mit, damit die Ansicht ihre abgeleiteten Listen nur
  // dann neu berechnet, wenn sich am Puffer etwas getan hat.
  public version = 0;

  constructor(
    private readonly _storage: StorageService,
    gameId: number
  ) {
    this._key = KEY_PREFIX + gameId;
    this._state = this._load();
  }

  // Der Speicher wird nur beim Anlegen gelesen und danach bei jeder Änderung
  // geschrieben. Ein Lesen pro Zugriff hieße einmal JSON.parse je
  // Änderungserkennung.
  private _read(): BufferState {
    return {
      upserts: [...this._state.upserts],
      deletes: [...this._state.deletes],
    };
  }

  private _load(): BufferState {
    try {
      const parsed = JSON.parse(this._storage.getItem(this._key) || '{}');
      return {
        upserts: Array.isArray(parsed.upserts) ? parsed.upserts : [],
        deletes: Array.isArray(parsed.deletes) ? parsed.deletes : [],
      };
    } catch {
      return { upserts: [], deletes: [] };
    }
  }

  private _write(state: BufferState): void {
    this._state = state;
    this.version++;
    if (!state.upserts.length && !state.deletes.length) {
      this._storage.removeItem(this._key);
      return;
    }
    this._storage.setItem(this._key, JSON.stringify(state));
  }

  get upserts(): ShotInput[] {
    return this._read().upserts;
  }

  get deletes(): string[] {
    return this._read().deletes;
  }

  get size(): number {
    const state = this._read();
    return state.upserts.length + state.deletes.length;
  }

  /** Neuer oder korrigierter Schuss; ersetzt eine ältere Fassung. */
  upsert(shot: ShotInput): void {
    const state = this._read();
    state.upserts = state.upserts.filter(
      (entry) => entry.client_uuid !== shot.client_uuid
    );
    state.upserts.push({ ...shot });
    state.deletes = state.deletes.filter((uuid) => uuid !== shot.client_uuid);
    this._write(state);
  }

  /**
   * Schuss verwerfen. `knownToServer`: Nur was der Server schon kennt, braucht
   * eine Löschung dort. Ein nie bestätigter Schuss verschwindet lokal.
   */
  remove(clientUuid: string, knownToServer: boolean): void {
    const state = this._read();
    state.upserts = state.upserts.filter(
      (entry) => entry.client_uuid !== clientUuid
    );
    if (knownToServer && !state.deletes.includes(clientUuid)) {
      state.deletes.push(clientUuid);
    }
    this._write(state);
  }

  /** Vom Server bestätigte Schüsse austragen, sofern seither unverändert. */
  acknowledgeUpserts(sent: ShotInput[]): void {
    const sentJson = new Map(
      sent.map((shot) => [shot.client_uuid, JSON.stringify(shot)])
    );
    const state = this._read();
    state.upserts = state.upserts.filter(
      (entry) => sentJson.get(entry.client_uuid) !== JSON.stringify(entry)
    );
    this._write(state);
  }

  acknowledgeDelete(clientUuid: string): void {
    const state = this._read();
    state.deletes = state.deletes.filter((uuid) => uuid !== clientUuid);
    this._write(state);
  }
}
