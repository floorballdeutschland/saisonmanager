import { getTranslocoTestingModule } from '@floorball/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { GameDayEditComponent } from './game-day-edit.component';
import { Club, GamedayInput } from '@floorball/models';

describe('GameDayEditComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        getTranslocoTestingModule(),
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      declarations: [GameDayEditComponent],
    })
      .overrideTemplate(GameDayEditComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(GameDayEditComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // fe#318: Der Ausrichter wird hier zugewiesen, ein deaktivierter Verein
  // gehört also nicht in die Trefferliste. Der bereits eingetragene bleibt
  // stehen, damit ein Bestands-Spieltag seinen Verein behält.
  describe('Ausrichter-Suche', () => {
    function build(clubId: number): GameDayEditComponent {
      const component =
        TestBed.createComponent(GameDayEditComponent).componentInstance;
      component.gameday = { id: 1, club_id: clubId } as GamedayInput;
      component.allClubs = [
        { id: 1, name: 'Aktiv' } as Club,
        { id: 2, name: 'Deaktiviert', deactivated: true } as Club,
      ];
      component['_filterClubs']();
      return component;
    }

    it('bietet keine deaktivierten Vereine an', () => {
      expect(build(0).filteredClubs.map((c) => c.id)).toEqual([1]);
    });

    it('behält den bereits eingetragenen Ausrichter', () => {
      expect(build(2).filteredClubs.map((c) => c.id)).toEqual([1, 2]);
    });
  });
});
