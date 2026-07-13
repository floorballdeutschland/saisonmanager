import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { LeagueService } from '@floorball/core';
import { GameOperationWithLeagues } from '@floorball/types';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';

@Component({
  selector: 'fb-license-user-index',
  templateUrl: './license-user-league-index.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class LicenseUserLeagueIndexComponent implements OnInit {
  gameOperations: GameOperationWithLeagues[] = [];

  constructor(
    private _leagueService: LeagueService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title,
    private _transloco: TranslocoService
  ) {}

  ngOnInit(): void {
    // Titel erst setzen, wenn der lazy geladene Scope 'admin/license' verfügbar
    // ist – im Konstruktor liefert translate() sonst nur den rohen Key-Pfad.
    // selectTranslate() lädt scope-korrekt und emittiert erst nach dem Laden;
    // selectTranslation('admin/license') fehlinterpretiert den zweistufigen Pfad.
    this._transloco
      .selectTranslate('userLeagueIndex.metaTitle', {}, 'admin/license')
      .pipe(take(1))
      .subscribe(() =>
        this._metaTitle.setTitle(
          this._transloco.translate('licenseAdmin.userLeagueIndex.metaTitle')
        )
      );

    this.getGameOperations();
  }

  public getGameOperations(): void {
    this._leagueService.getUserLeaguesLicenseIndex().subscribe({
      next: (gameOperations) => {
        this.gameOperations = gameOperations;

        this._cdr.markForCheck();
      },
    });
  }
}
