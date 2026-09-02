import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input } from '@angular/core';
import { By } from '@angular/platform-browser';

import { MatchReportIntroComponent } from './match-report-intro.component';

@Component({ selector: 'fb-overlay-links', template: '', standalone: false })
class OverlayLinksStubComponent {
  @Input() gameDayId?: number | null;
  @Input() label = '';
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
    // Die Vorlage liest die Spieltags-Kennung für die Overlay-Links; ohne Spiel
    // stünde hier ein Zugriff auf undefined.
    component.game = { id: 1, game_day_id: 7 } as never;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Der Kern der Sache: Wer überträgt, braucht die Overlay-Adressen, ohne die
  // Eingabe zu starten. Das Starten setzt den Spielstatus und ist öffentlich
  // sichtbar, deshalb steht der Abschnitt schon auf dieser Seite.
  it('bietet die Overlay-Links schon vor dem Start der Eingabe an', () => {
    // Frisches Fixture: Das Spiel muss vor der ersten Prüfung stehen.
    fixture = TestBed.createComponent(MatchReportIntroComponent);
    fixture.componentInstance.game = {
      id: 1,
      game_day_id: 7,
      game_number: '4711',
    } as never;
    fixture.detectChanges();

    const overlay = fixture.debugElement.query(
      By.directive(OverlayLinksStubComponent)
    ).componentInstance as OverlayLinksStubComponent;
    expect(overlay.gameDayId).toBe(7);
    // Die Spielnummer benennt die Szenensammlung, die dort zum Herunterladen
    // steht – der Zugang selbst gilt für den ganzen Spieltag.
    expect(overlay.label).toBe('Spiel 4711');
  });
});
