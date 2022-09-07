import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import {
  Club,
  GameScheduleEntry,
  League,
  LeagueClass,
  LeagueWithTeams,
  ScorerEntry,
  TableEntry,
  Team,
} from '@floorball/types';
import { ActivatedRoute } from '@angular/router';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';
import { AssociationService } from '.';
import { GameOperationWithClubs } from 'src/app/_models/game-operation.interface';

@Injectable({
  providedIn: 'root',
})
export class ClubService {
  private _route$ = new BehaviorSubject<ActivatedRoute | null>(null);

  constructor(
    private http: HttpClient,
    private _associationService: AssociationService
  ) {}

  //
  // admin routes
  //
  public getAdminClubs() {
    const path = environment.apiURL + 'admin/clubs.json';
    return this.http.get<GameOperationWithClubs[]>(path);
  }

  public getAdminClub(clubId: number) {
    const path = environment.apiURL + 'admin/clubs/' + clubId + '.json';
    return this.http.get<Club>(path);
  }

  public getAdminClubAll() {
    const path = environment.apiURL + 'admin/clubs/all.json';
    return this.http.get<Club[]>(path);
  }

  public adminCreateClub(club: Club) {
    const path = environment.apiURL + 'admin/clubs.json';
    return this.http.post<Club>(path, club);
  }
}
