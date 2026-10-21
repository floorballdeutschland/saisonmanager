import { Injectable } from '@angular/core';
import { Subject, lastValueFrom } from 'rxjs';

import { GameShotService, StorageService } from '@floorball/core';
import { Shot } from '@floorball/types';

import { ShotBuffer } from './shot-buffer';

export interface ShotSyncState {
  syncing: boolean;
  // Fachliche Absage (4xx): Automatisch wird nicht weiter gesendet, sonst
  // stapelte der ErrorInterceptor bei jedem Versuch dieselbe Meldung.
  blocked: boolean;
  // 403: Der Bericht ist geschlossen oder die Berechtigung fehlt. Die
  // Erfassung sagt das selbst, der Interceptor schweigt dazu.
  forbidden: boolean;
}

const IDLE: ShotSyncState = {
  syncing: false,
  blocked: false,
  forbidden: false,
};

/**
 * Übertragung der gepufferten Tablet-Schüsse (fe#344), je Spiel.
 *
 * Als Dienst und nicht in der Erfassung, weil zwei Stellen sie brauchen: die
 * Erfassung selbst und der Abschluss des Spielberichts, der vorher alles
 * Ungesendete dieses Geräts loswerden will. Dienst und Puffer hängen an der
 * Spiel-ID, nicht an einer Ansicht: Ein Spielwechsel mitten in einer
 * Übertragung lässt diese zu Ende laufen, ohne den Zustand des neuen Spiels
 * zu berühren.
 */
@Injectable({
  providedIn: 'root',
})
export class TabletShotSyncService {
  private readonly _buffers = new Map<number, ShotBuffer>();
  private readonly _states = new Map<number, ShotSyncState>();
  private readonly _running = new Map<number, Promise<boolean>>();

  /** Serverstand nach jeder erfolgreichen Antwort, mit Spiel-ID. */
  public readonly shots$ = new Subject<{ gameId: number; shots: Shot[] }>();

  constructor(
    private _shotService: GameShotService,
    private _storage: StorageService
  ) {}

  public buffer(gameId: number): ShotBuffer {
    let buffer = this._buffers.get(gameId);
    if (!buffer) {
      buffer = new ShotBuffer(this._storage, gameId);
      this._buffers.set(gameId, buffer);
    }
    return buffer;
  }

  public state(gameId: number): ShotSyncState {
    return this._states.get(gameId) ?? IDLE;
  }

  public pendingCount(gameId: number): number {
    return this.buffer(gameId).size;
  }

  /** Erneut senden nach einer Absage, ausdrücklich angestoßen. */
  public retry(gameId: number): Promise<void> {
    this._patch(gameId, { blocked: false, forbidden: false });
    return this.flush(gameId);
  }

  /** Senden, sofern nicht nach einer Absage gesperrt. */
  public flushIfAllowed(gameId: number): Promise<void> {
    if (this.state(gameId).blocked) return Promise.resolve();
    return this.flush(gameId);
  }

  /**
   * Sendet den Puffer: erst vorgemerkte Löschungen, dann alle neuen und
   * geänderten Schüsse in einem POST. Läuft schon eine Übertragung für das
   * Spiel, liefert der Aufruf deren Ende, sodass ein Wartender (Abschluss)
   * erst danach nachzählt. Was währenddessen dazukam, geht gleich hinterher,
   * aber nur nach einem erfolgreichen Durchlauf: Nach einem Fehlschlag
   * übernimmt der Takt der Erfassung, sonst hämmerte ein Funkloch in einer
   * Schleife auf den Server.
   */
  public flush(gameId: number): Promise<void> {
    const running = this._running.get(gameId);
    if (running) {
      return running.then((ok) =>
        ok && this.pendingCount(gameId) > 0
          ? this.flushIfAllowed(gameId)
          : undefined
      );
    }

    const buffer = this.buffer(gameId);
    if (buffer.size === 0) return Promise.resolve();

    const promise = this._run(gameId, buffer).finally(() => {
      this._running.delete(gameId);
    });
    this._running.set(gameId, promise);
    return promise.then((ok) =>
      ok && buffer.size > 0 ? this.flush(gameId) : undefined
    );
  }

  private async _run(gameId: number, buffer: ShotBuffer): Promise<boolean> {
    this._patch(gameId, { syncing: true });
    try {
      for (const uuid of buffer.deletes) {
        try {
          const shots = await lastValueFrom(
            this._shotService.deleteShot(gameId, uuid)
          );
          this.shots$.next({ gameId, shots });
        } catch (err) {
          // Schon weg (etwa weil die erste Antwort verloren ging): erledigt.
          if ((err as { status?: number })?.status !== 404) throw err;
        }
        buffer.acknowledgeDelete(uuid);
      }

      const upserts = buffer.upserts;
      if (upserts.length) {
        buffer.markSent(upserts);
        const shots = await lastValueFrom(
          this._shotService.saveShots(gameId, upserts)
        );
        buffer.acknowledgeUpserts(upserts);
        this.shots$.next({ gameId, shots });
      }
      this._patch(gameId, { syncing: false, blocked: false, forbidden: false });
      return true;
    } catch (err) {
      const status = (err as { status?: number })?.status ?? 0;
      const rejected = status >= 400 && status < 500;
      this._patch(gameId, {
        syncing: false,
        blocked: rejected,
        forbidden: status === 403,
      });
      return false;
    }
  }

  private _patch(gameId: number, changes: Partial<ShotSyncState>): void {
    this._states.set(gameId, { ...this.state(gameId), ...changes });
  }
}
