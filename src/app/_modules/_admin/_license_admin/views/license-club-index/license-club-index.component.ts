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
    this._transloco
      .selectTranslation('admin/license')
      .pipe(take(1))
      .subscribe(() =>
        this._metaTitle.setTitle(
          this._transloco.translate('licenseAdmin.clubIndex.metaTitle')
        )
      );

    this._clubService.adminGetClubAndTeams().subscribe({
      next: (result) => {
        this.clubAndTeams = result;

        this._cdr.markForCheck();
      },
    });
  }
}
