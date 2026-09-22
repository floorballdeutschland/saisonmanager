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

  // Karma laedt die gebaute Tailwind-Datei, die Schriftgroesse steht also
  // wirklich an. Geprueft wird die Beziehung, nicht der Zahlenwert: Die
  // Zwischenueberschrift muss kleiner sein als der Grundtext, sonst steht sie
  // wieder gleichrangig neben dem Mannschaftsnamen darueber.
  it('setzt die Ueberschrift kleiner als den Grundtext', () => {
    component.title = 'Betreuer';
    fixture.detectChanges();

    const heading = (fixture.nativeElement as HTMLElement).querySelector('h4');

    expect(heading?.textContent).toContain('Betreuer');
    expect(parseFloat(getComputedStyle(heading!).fontSize)).toBeLessThan(16);
  });

  it('nennt das Mannschaftskuerzel nur in der einspaltigen Handy-Ansicht', () => {
    component.title = 'Starting six';
    component.teamShortName = 'FBB 2';
    fixture.detectChanges();

    const suffix = (fixture.nativeElement as HTMLElement).querySelector('span');

    expect(suffix?.textContent).toContain('FBB 2');
    // Das Karma-Fenster ist breiter als der md-Breakpoint, md:hidden greift
    // hier also und laesst sich als Wirkung pruefen.
    expect(getComputedStyle(suffix!).display).toBe('none');
  });

  it('bleibt ohne Kuerzel bei der reinen Ueberschrift', () => {
    component.title = 'Starting four';
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('span')).toBe(
      null
    );
  });
});
