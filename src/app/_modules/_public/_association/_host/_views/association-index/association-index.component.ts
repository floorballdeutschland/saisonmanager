import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AssociationService, LeagueService } from '@floorball/core';
import { GameOperation, League } from '@floorball/types';
import { Observable } from 'rxjs';

@Component({
  selector: 'fb-association-index',
  templateUrl: './association-index.component.html',
  styleUrls: ['./association-index.component.scss'],
})
export class AssociationIndexComponent implements OnInit {
  leagues: League[] = [];
  selectedAssociation$!: Observable<GameOperation | null>;
  leagues$!: Observable<League[] | null>;

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.selectedAssociation$ = this._associationService.selectedAssociation$;
    this.leagues$ = this._leagueService.leagues$;
  }
}
