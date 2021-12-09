import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {
  AssociationService,
  FavoriteService,
  LeagueService,
} from '@floorball/core';
import { GameOperation, League, LeagueWithOperation } from '@floorball/types';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

@Component({
  selector: 'fb-mobile-header',
  templateUrl: './mobile-header.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileHeaderComponent implements OnInit {
  isLoading$!: Observable<boolean>;
  leagues$!: Observable<League[] | null>;
  selectedAssociation$!: Observable<GameOperation | null>;
  favoriteLeagues$?: BehaviorSubject<LeagueWithOperation[]>;

  @Output()
  closeNavigationOverlay: EventEmitter<boolean> = new EventEmitter<boolean>();

  @ViewChild('closeButton')
  closeButton!: ElementRef<HTMLButtonElement>;

  onClose$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _favoriteService: FavoriteService
  ) {}

  ngOnInit(): void {
    this.isLoading$ = this._associationService.associationsIsLoading$;
    this.leagues$ = this._leagueService.leagues$;
    this.selectedAssociation$ = this._associationService.selectedAssociation$;
    this.favoriteLeagues$ = this._favoriteService.favoriteLeagues$;
  }

  close() {
    this.onClose$.next(true);
  }
}
