import { TestBed } from '@angular/core/testing';

import { MatchPairingComponent } from './match-pairing.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { UikitCommonModule } from '@floorball/uikit/common';
import { GameScheduleEntry } from '@floorball/types';

describe('MatchPairingComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        UikitCommonModule,
      ],
      declarations: [MatchPairingComponent],
    }).compileComponents();
  });

  function render(match: Partial<GameScheduleEntry>): HTMLElement {
    const fixture = TestBed.createComponent(MatchPairingComponent);
    fixture.componentRef.setInput('match', {
      game_id: 1,
      home_team_name: 'Laikas',
      guest_team_name: 'SCS Berlin',
      date: '2026-10-04',
      time: '11:00',
      started: false,
      ended: false,
      ...match,
    } as GameScheduleEntry);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('should create', () => {
    const fixture = TestBed.createComponent(MatchPairingComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('zeigt Datum und Uhrzeit ohne Hinweis', () => {
    const text = render({}).textContent;
    expect(text).toContain('04.10.2026');
    expect(text).toContain('11:00 Uhr');
  });

  // Der Hinweis lag frueher absolut ueber Datum und Uhrzeit, die trotzdem
  // gerendert wurden und mobil darunter hervorschauten.
  it('blendet Datum und Uhrzeit bei verschobenem Spiel aus', () => {
    const text = render({ notice_type: 'Postponed' }).textContent;
    expect(text).toContain('Spiel verschoben');
    expect(text).not.toContain('04.10.2026');
    expect(text).not.toContain('11:00 Uhr');
  });
});
