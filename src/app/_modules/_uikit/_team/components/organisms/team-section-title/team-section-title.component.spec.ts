import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamSectionTitleComponent } from './team-section-title.component';

describe('TeamSectionTitleComponent', () => {
  let component: TeamSectionTitleComponent;
  let fixture: ComponentFixture<TeamSectionTitleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TeamSectionTitleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TeamSectionTitleComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    component.title = 'Starting six';
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('rendert die Ueberschrift als eigene Ebene unter dem Mannschaftsnamen', () => {
    component.title = 'Betreuer';
    fixture.detectChanges();

    const heading = (fixture.nativeElement as HTMLElement).querySelector('h4');

    expect(heading?.textContent).toContain('Betreuer');
  });

  it('nennt das Mannschaftskuerzel nur in der einspaltigen Handy-Ansicht', () => {
    component.title = 'Starting six';
    component.teamShortName = 'FBB 2';
    fixture.detectChanges();

    const suffix = (fixture.nativeElement as HTMLElement).querySelector('span');

    expect(suffix?.textContent).toContain('FBB 2');
    expect(suffix?.classList).toContain('md:hidden');
  });

  it('bleibt ohne Kuerzel bei der reinen Ueberschrift', () => {
    component.title = 'Starting four';
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('span')).toBe(
      null
    );
  });
});
