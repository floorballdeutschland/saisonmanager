import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';
import { LiveStreamService } from '@floorball/core';
import { LiveStreamGame } from '@floorball/types';

/**
 * „Heute live": Welche Spiele des Tages übertragen werden.
 *
 * Die Bundesliga-Vereine haben Streaming-Pflicht, die Adressen stehen im
 * Spielbericht — bisher gab es aber keine Stelle, an der jemand nachsieht, was
 * gerade läuft.
 *
 * Sortiert und in drei Blöcke geteilt kommt die Liste bereits vom Server
 * (laufende zuerst, dann anstehende, darunter die beendeten). Hier wird sie nur
 * aufgeteilt, damit jeder Block seine Überschrift bekommt.
 */
@Component({
  templateUrl: './live.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LiveComponent implements OnInit, OnDestroy {
  public running: LiveStreamGame[] = [];
  public upcoming: LiveStreamGame[] = [];
  public ended: LiveStreamGame[] = [];
  public loading = true;
  public failed = false;
  public date = '';

  // Die Seite bleibt auf einem Hallenmonitor oder einem zweiten Bildschirm
  // stundenlang offen. Ohne Nachladen stünde dort abends noch der Stand vom
  // Nachmittag.
  private readonly _refreshMs = 60_000;
  private _timer = 0;

  constructor(
    private _liveStreamService: LiveStreamService,
    private _cdr: ChangeDetectorRef,
    private _title: Title,
    private _transloco: TranslocoService
  ) {}

  ngOnInit(): void {
    this._title.setTitle(
      `${this._transloco.translate('live.pageTitle')} | Floorball Saisonmanager`
    );
    this.load();
    this._timer = window.setInterval(() => this.load(), this._refreshMs);
  }

  ngOnDestroy(): void {
    // Ohne das Aufräumen liefe der Timer nach dem Verlassen der Seite weiter und
    // rief markForCheck auf einer View auf, die es nicht mehr gibt.
    window.clearInterval(this._timer);
  }

  public get isEmpty(): boolean {
    return (
      !this.loading &&
      !this.failed &&
      !this.running.length &&
      !this.upcoming.length &&
      !this.ended.length
    );
  }

  public load(): void {
    this._liveStreamService.getToday().subscribe({
      next: (day) => {
        this.date = day.date;
        this.running = day.games.filter((g) => g.status === 'running');
        this.upcoming = day.games.filter((g) => g.status === 'upcoming');
        this.ended = day.games.filter((g) => g.status === 'ended');
        this.loading = false;
        this.failed = false;
        this._cdr.markForCheck();
      },
      error: () => {
        // Beim ersten Versuch ein Hinweis, danach nicht mehr: Ein Aussetzer beim
        // Nachladen darf eine bereits stehende Liste nicht gegen eine
        // Fehlermeldung tauschen.
        this.failed = this.loading;
        this.loading = false;
        this._cdr.markForCheck();
      },
    });
  }

  /** Zwischenstand, sofern vorhanden. Sonst leer statt „0:0". */
  public score(game: LiveStreamGame): string {
    return game.result_string ?? '';
  }

  public period(game: LiveStreamGame): string {
    return game.current_period_title?.title ?? '';
  }
}
