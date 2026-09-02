import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input } from '@angular/core';
import { By } from '@angular/platform-browser';

import { MatchReportIntroComponent } from './match-report-intro.component';

@Component({ selector: 'fb-overlay-links', template: '', standalone: false })
class OverlayLinksStubComponent {
  @Input() game!: unknown;
}

describe('MatchReportIntroComponent', () => {
  let component: MatchReportIntroComponent;
  let fixture: ComponentFixture<MatchReportIntroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MatchReportIntroComponent, OverlayLinksStubComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MatchReportIntroComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Der Kern der Sache: Wer überträgt, braucht die Overlay-Adressen, ohne die
  // Eingabe zu starten. Das Starten setzt den Spielstatus und ist öffentlich
  // sichtbar, deshalb steht der Abschnitt schon auf dieser Seite.
  it('bietet die Overlay-Links schon vor dem Start der Eingabe an', () => {
    const game = { id: 1, game_day_id: 7 } as never;
    // Frisches Fixture: Das Spiel muss vor der ersten Prüfung stehen.
    fixture = TestBed.createComponent(MatchReportIntroComponent);
    fixture.componentInstance.game = game;
    fixture.detectChanges();

    const overlay = fixture.debugElement.query(
      By.directive(OverlayLinksStubComponent)
    ).componentInstance as OverlayLinksStubComponent;
    expect(overlay.game).toBe(game);
  });
});
