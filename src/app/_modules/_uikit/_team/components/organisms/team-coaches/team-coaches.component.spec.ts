import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamCoachesComponent } from './team-coaches.component';
import { GameCoach } from '@floorball/models';

describe('TeamCoachesComponent', () => {
  let component: TeamCoachesComponent;
  let fixture: ComponentFixture<TeamCoachesComponent>;

  const coach = (slot: number, name: string): GameCoach => ({
    slot,
    first_name: name.split(' ')[0],
    last_name: name.split(' ')[1] ?? '',
    name,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TeamCoachesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TeamCoachesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('listet alle Betreuer in der Reihenfolge des Spielberichts', () => {
    component.coaches = [
      coach(1, 'Meier, Anna'),
      coach(2, 'Sanchez, Bruno'),
      coach(5, 'Wolf, Carla'),
    ];

    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Betreuer');
    expect(text).toContain('Meier, Anna');
    expect(text).toContain('Sanchez, Bruno');
    expect(text).toContain('Wolf, Carla');
    expect(text.indexOf('Meier, Anna')).toBeLessThan(
      text.indexOf('Sanchez, Bruno')
    );
  });

  it('bleibt ohne Betreuer vollstaendig leer', () => {
    component.coaches = [];
    fixture.detectChanges();

    expect(
      ((fixture.nativeElement as HTMLElement).textContent ?? '').trim()
    ).toBe('');
  });

  it('bleibt auch ohne Angabe leer', () => {
    component.coaches = undefined;
    fixture.detectChanges();

    expect(
      ((fixture.nativeElement as HTMLElement).textContent ?? '').trim()
    ).toBe('');
  });
});
