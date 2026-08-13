import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  GameOperation,
  InitData,
  Season,
  StateAssociation,
} from '@floorball/types';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AssociationService {
  associationsIsLoading$ = new BehaviorSubject(false);
  associations$: Observable<GameOperation[]>;
  selectedAssociation$: Observable<GameOperation | null>;
  selectedStateAssociation$: Observable<StateAssociation | null>;
  stateAssociations$: Observable<StateAssociation[]>;

  currentSeasonId$: Observable<number>;
  selectedSeason$: Observable<Season | null>;
  seasons$: Observable<Season[]>;
  infoLinks$: Observable<Record<string, string>>;

  displayAssociationHeader$ = new BehaviorSubject(true);

  private _route$ = new BehaviorSubject<ActivatedRoute | null>(null);
  private _selectedSeasonId$ = new BehaviorSubject<number | null>(null);
  // Nach dem Pflegen einer Adresse gilt der neue Wert sofort, ohne Neuladen der
  // Seite. null = Link entfernt. Wird über init gelegt, nicht daneben.
  private _infoLinkOverrides$ = new BehaviorSubject<
    Record<string, string | null>
  >({});

  constructor(private http: HttpClient) {
    this.associationsIsLoading$.next(true);

    const initData$ = this.getInit().pipe(shareReplay());

    this.associations$ = initData$.pipe(
      map((_result) => _result.game_operations)
    );

    this.seasons$ = initData$.pipe(map((_result) => _result.seasons));

    this.stateAssociations$ = initData$.pipe(
      map((_result) => _result.state_associations ?? [])
    );

    // init wird genau einmal geladen (shareReplay). Ohne die Overrides bliebe
    // eine gerade gepflegte Adresse bis zum nächsten vollständigen Seitenaufbau
    // unsichtbar – wer den Link korrigiert und ihn danach im Lizenzantrag
    // nachsieht, bekäme weiter die alte, tote Adresse zu sehen.
    // combineLatest emittiert erst, wenn init da ist; ein take(1) beim Aufrufer
    // greift also nie einen leeren Zwischenstand ab.
    this.infoLinks$ = combineLatest([
      initData$.pipe(map((_result) => _result.info_links ?? {})),
      this._infoLinkOverrides$,
    ]).pipe(
      map(([links, overrides]) => {
        const merged: Record<string, string> = { ...links };
        Object.entries(overrides).forEach(([key, url]) => {
          if (url) {
            merged[key] = url;
          } else {
            delete merged[key];
          }
        });
        return merged;
      }),
      shareReplay(1)
    );

    // Seed the BehaviorSubject with the current season from init
    initData$
      .pipe(tap((d) => this._selectedSeasonId$.next(d.current_season_id)))
      .subscribe();

    this.currentSeasonId$ = this._selectedSeasonId$.pipe(
      switchMap((id) => (id !== null ? of(id) : of(0)))
    );

    this.selectedSeason$ = combineLatest([
      this.seasons$,
      this._selectedSeasonId$,
    ]).pipe(
      map(([seasons, selectedId]) => {
        if (!seasons) return null;
        return seasons.find((_s) => _s.id === selectedId) ?? null;
      })
    );

    this.associations$
      .pipe(tap(() => this.associationsIsLoading$.next(false)))
      .subscribe();

    this.selectedAssociation$ = this._route$.pipe(
      switchMap((_route) => {
        if (!this.associations$ || !_route) {
          return of(null);
        }

        return this.associations$.pipe(
          map(
            (_associations) =>
              _associations.find(
                (_association) =>
                  _association.path === _route.snapshot.params['association']
              ) ?? null
          )
        );
      })
    );

    this.selectedStateAssociation$ = combineLatest([
      this.selectedAssociation$,
      this.stateAssociations$,
    ]).pipe(
      map(([go, sas]) => {
        if (!go?.state_association_id) return null;
        return sas.find((sa) => sa.id === go.state_association_id) ?? null;
      })
    );
  }

  selectAssociation(route: ActivatedRoute) {
    this._route$.next(route);
  }

  clearAssociation() {
    this._route$.next(null);
  }

  selectSeason(seasonId: number) {
    // Gleiche Saison nicht erneut emittieren – sonst lösen Aufrufer wie der
    // Einzel-Liga-Fallback im LeagueService unnötige Neu-Ladungen aus.
    if (this._selectedSeasonId$.value !== seasonId) {
      this._selectedSeasonId$.next(seasonId);
    }
  }

  // Adresse eines gepflegten Informationsblattes, null solange keine hinterlegt
  // ist. Aufrufer blenden den Link dann aus, statt eine tote Adresse anzubieten.
  public infoLinkUrl$(key: string): Observable<string | null> {
    return this.infoLinks$.pipe(map((links) => links[key] ?? null));
  }

  // Von der Pflege-Ansicht nach erfolgreichem Speichern aufzurufen, damit die
  // neue Adresse ohne Neuladen gilt. url = null entfernt den Link.
  public setInfoLink(key: string, url: string | null): void {
    this._infoLinkOverrides$.next({
      ...this._infoLinkOverrides$.value,
      [key]: url,
    });
  }

  public getInit() {
    const path = environment.apiURL + 'init.json';
    return this.http.get<InitData>(path);
  }
}
