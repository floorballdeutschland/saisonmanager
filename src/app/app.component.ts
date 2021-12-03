import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {
  AssociationService,
  FavoriteService,
  LeagueService,
  StorageService,
} from '@floorball/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameOperation, League, LeagueWithOperation } from '@floorball/types';

@Component({
  selector: 'fb-root',
  templateUrl: './app.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  isLoading$!: Observable<boolean>;
  leagues$!: Observable<League[] | null>;
  selectedAssociation$!: Observable<GameOperation | null>;

  favoriteLeagues$?: BehaviorSubject<LeagueWithOperation[]>;

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _storageService: StorageService,
    private _favoriteService: FavoriteService
  ) {}
  ngOnInit(): void {
    this.isLoading$ = this._associationService.associationsIsLoading$;
    this.leagues$ = this._leagueService.leagues$;
    this.selectedAssociation$ = this._associationService.selectedAssociation$;
    this.favoriteLeagues$ = this._favoriteService.favoriteLeagues$;
  }
}
