import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AssociationService, LeagueService } from '@floorball/core';
import { GameOperation, League, StateAssociation } from '@floorball/types';
import { combineLatest, map, Observable, Subject, takeUntil, tap } from 'rxjs';

@Component({
  templateUrl: './association-host.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssociationHostComponent implements OnInit, OnDestroy {
  selectedAssociation$!: Observable<GameOperation | null>;
  association$!: Observable<GameOperation[]>;
  leagues$?: Observable<League[] | null>;
  selectedStateAssociation$!: Observable<StateAssociation | null>;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    this._associationService.clearAssociation();
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  ngOnInit(): void {
    this.selectedAssociation$ = this._associationService.selectedAssociation$;
    this.leagues$ = this._leagueService.leagues$;
    this.association$ = this._associationService.associations$;

    this.selectedStateAssociation$ = combineLatest([
      this._associationService.selectedAssociation$,
      this._associationService.stateAssociations$,
    ]).pipe(
      map(([go, sas]) => {
        if (!go?.state_association_id) return null;
        return sas.find((sa) => sa.id === go.state_association_id) ?? null;
      })
    );

    this._route.params
      .pipe(
        tap(() => {
          this._associationService.selectAssociation(this._route);
          this._cdr.markForCheck();
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }

  safeBannerLink(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:'
        ? url
        : null;
    } catch {
      return null;
    }
  }
}
