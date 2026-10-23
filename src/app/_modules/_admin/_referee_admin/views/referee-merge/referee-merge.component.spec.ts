import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import {
  getTranslocoTestingModule,
  NotificationService,
  RefereeService,
} from '@floorball/core';
import { RefereeAdmin } from '@floorball/models';

import { RefereeMergeComponent } from './referee-merge.component';

// api#845: Behalten wird das Profil mit der kleinsten Schiedsrichternummer,
// egal von welchem Profil aus die Maske geoeffnet wurde.
describe('RefereeMergeComponent', () => {
  function referee(attrs: Partial<RefereeAdmin>): RefereeAdmin {
    return {
      id: 1,
      lizenznummer: null,
      lizenznummer_display: '',
      guest: false,
      vorname: 'Jens',
      nachname: 'Kürbis',
      ...attrs,
    } as RefereeAdmin;
  }

  const oldProfile = referee({
    id: 18392,
    lizenznummer: 921,
    lizenznummer_display: '921',
    lizenzstufe: 'LJ',
    gueltigkeit: '2010-07-31',
  });
  const currentProfile = referee({
    id: 5299,
    lizenznummer: 3454,
    lizenznummer_display: '3454',
    lizenzstufe: 'N2',
    gueltigkeit: '2028-09-30',
  });

  function build(
    master: RefereeAdmin,
    secondary: RefereeAdmin
  ): RefereeMergeComponent {
    const component = TestBed.createComponent(
      RefereeMergeComponent
    ).componentInstance;
    component.master = master;
    component.secondary = secondary;
    return component;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        getTranslocoTestingModule(),
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      declarations: [RefereeMergeComponent],
    })
      .overrideTemplate(RefereeMergeComponent, '')
      .compileComponents();
  });

  it('behaelt die kleinere Nummer, auch wenn die Maske vom anderen Profil aus geoeffnet wurde', () => {
    const component = build(currentProfile, oldProfile);

    expect(component.kept).toBe(oldProfile);
    expect(component.dropped).toBe(currentProfile);
  });

  it('behaelt das gewaehlte Profil, wenn es die kleinere Nummer hat', () => {
    const component = build(oldProfile, currentProfile);

    expect(component.kept).toBe(oldProfile);
  });

  it('behaelt bei zwei Gaesten ohne Nummer das gewaehlte Profil', () => {
    const a = referee({ id: 1, guest: true, lizenznummer_display: 'G-1' });
    const b = referee({ id: 2, guest: true, lizenznummer_display: 'G-2' });

    expect(build(b, a).kept).toBe(b);
  });

  it('kuendigt den Nummernwechsel an, wenn das wegfallende Profil die spaetere Lizenz traegt', () => {
    expect(build(currentProfile, oldProfile).numberChanges).toBeTrue();
  });

  it('kuendigt keinen Nummernwechsel an, wenn das behaltene Profil das aktuelle ist', () => {
    const current = referee({ ...currentProfile, lizenznummer: 500 });

    expect(build(current, oldProfile).numberChanges).toBeFalse();
  });

  it('springt nach dem Zusammenfuehren zum Master aus der Antwort', () => {
    const component = build(currentProfile, oldProfile);
    const refereeService = TestBed.inject(RefereeService);
    const router = TestBed.inject(Router);
    spyOn(refereeService, 'adminMerge').and.returnValue(
      of({
        message: 'ok',
        master_id: oldProfile.id,
        master_lizenznummer_display: '921',
      })
    );
    spyOn(TestBed.inject(NotificationService), 'success');
    spyOn(router, 'navigate');

    component.merge();

    expect(refereeService.adminMerge).toHaveBeenCalledWith(
      currentProfile.id,
      oldProfile.id
    );
    expect(router.navigate).toHaveBeenCalledWith([
      '/',
      'verwaltung',
      'schiedsrichter',
      '921',
    ]);
  });
});
