import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { Club } from '@floorball/models';

import { RefereeEditComponent } from './referee-edit.component';

describe('RefereeEditComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        getTranslocoTestingModule(),
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      declarations: [RefereeEditComponent],
    })
      .overrideTemplate(RefereeEditComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(RefereeEditComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // fe#318: Das Feld „Verein" weist zu, `clubs` benennt daneben aber auch den
  // bereits eingetragenen Verein — fb-select-search liest sein Label aus
  // `items`. Eingegrenzt wird deshalb nur die Auswahl.
  describe('selectableClubs', () => {
    function build(clubId?: number): RefereeEditComponent {
      const component =
        TestBed.createComponent(RefereeEditComponent).componentInstance;
      component.clubs = [
        { id: 1, name: 'Aktiv' } as Club,
        { id: 2, name: 'Deaktiviert', deactivated: true } as Club,
      ];
      component.referee = { club_id: clubId };
      return component;
    }

    it('bietet keine deaktivierten Vereine zur Auswahl an', () => {
      expect(build().selectableClubs.map((c) => c.id)).toEqual([1]);
    });

    it('behält den bereits eingetragenen Verein in der Liste', () => {
      expect(build(2).selectableClubs.map((c) => c.id)).toEqual([1, 2]);
    });
  });
});
