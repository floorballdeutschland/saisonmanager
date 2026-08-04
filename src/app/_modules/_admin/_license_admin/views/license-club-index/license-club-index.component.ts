import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import { AssociationService, ClubService } from '@floorball/core';
import {
  ClubWithTeams,
  GameOperation,
  GameOperationWithClubs,
} from '@floorball/types';
import { Observable, take } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';

@Component({
  templateUrl: './license-club-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class LicenseClubIndexComponent implements OnInit {
  associations$: Observable<GameOperation[]>;

  goClubItems$?: Observable<GameOperationWithClubs[]>;

  clubAndTeams: ClubWithTeams[] = [];

  constructor(
    private _associationService: AssociationService,
    private _clubService: ClubService,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title,
    private _transloco: TranslocoService
  ) {
    this.associations$ = this._associationService.associations$;
  }

  public ngOnInit(): void {
    // Titel erst setzen, wenn der lazy geladene Scope 'admin/license' verfügbar
    // ist – im Konstruktor liefert translate() sonst nur den rohen Key-Pfad.
    // selectTranslate() lädt scope-korrekt und emittiert erst nach dem Laden;
    // selectTranslation('admin/license') fehlinterpretiert den zweistufigen Pfad.
    this._transloco
      .selectTranslate('clubIndex.metaTitle', {}, 'admin/license')
      .pipe(take(1))
      .subscribe(() =>
        this._metaTitle.setTitle(
          this._transloco.translate('licenseAdmin.clubIndex.metaTitle')
        )
      );

    // Bewusst NICHT adminGetClubAndTeams(): das liefert alle Vereine, auf die
    // irgendeine Rolle Zugriff gibt. Wer zusätzlich SBK ist, bekam damit alle
    // Vereine des Spielbetriebs in diese Vereinssicht – und damit fremde
    // Vereine in einer Ansicht, die den eigenen Beantragungsprozess meint.
    this._clubService.vmGetClubAndTeams().subscribe({
      next: (result) => {
        this.clubAndTeams = result;

        this._cdr.markForCheck();
      },
    });
  }
}
