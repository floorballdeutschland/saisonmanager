import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { AssociationService, PlayerService } from '@floorball/core';
import { GameOperation } from '@floorball/types';
import { BehaviorSubject, of } from 'rxjs';
import { PlayerStatsComponent } from './player-stats.component';

describe('PlayerStatsComponent', () => {
  let fixture: ComponentFixture<PlayerStatsComponent>;
  let associations$: BehaviorSubject<GameOperation[]>;

  // Wie auf Prod: Der Pfad folgt nicht aus dem Kurznamen.
  const prodLike = [
    { id: 1, short_name: 'FD', path: 'fd' },
    { id: 2, short_name: 'SBK Ost', path: 'ost' },
    { id: 3, short_name: 'FLV-SH', path: 'flvsh' },
  ] as GameOperation[];

  beforeEach(() => {
    associations$ = new BehaviorSubject(prodLike);
    TestBed.configureTestingModule({
      declarations: [PlayerStatsComponent],
      providers: [
        provideRouter([]),
        { provide: AssociationService, useValue: { associations$ } },
        { provide: PlayerService, useValue: { getPlayerStats: () => of() } },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({})) },
        },
      ],
    });
    fixture = TestBed.createComponent(PlayerStatsComponent);
    fixture.detectChanges();
  });

  it('löst den Verbandspfad über den Kurznamen aus init.json auf', () => {
    const component = fixture.componentInstance;

    expect(component.associationPath('SBK Ost')).toBe('ost');
    expect(component.associationPath('FLV-SH')).toBe('flvsh');
    expect(component.associationPath('FD')).toBe('fd');
  });

  it('fällt bei unbekanntem Kurznamen auf die Kleinschreibung zurück', () => {
    expect(fixture.componentInstance.associationPath('Neu')).toBe('neu');
  });

  // Der Kurzname ist in der API nicht eindeutig validiert.
  it('rät bei mehrdeutigem Kurznamen nicht', () => {
    associations$.next([
      ...prodLike,
      { id: 4, short_name: 'SBK Ost', path: 'ost2' } as GameOperation,
    ]);

    expect(fixture.componentInstance.associationPath('SBK Ost')).toBe(
      'sbk ost'
    );
  });
});
