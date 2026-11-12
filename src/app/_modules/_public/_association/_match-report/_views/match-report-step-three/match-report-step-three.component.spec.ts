import { ChangeDetectorRef, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { Game, GameAdditionalFields } from '@floorball/types';
import { LeagueService } from '@floorball/core';
import { MatchReportStepThreeComponent } from './match-report-step-three.component';

// Die Klasse direkt bauen statt über das TestBed: Geprüft wird die
// Voreinstellung und der Warnhinweis, und dafür braucht es die 365 Zeilen
// Template nicht.
function build(): MatchReportStepThreeComponent {
  return new MatchReportStepThreeComponent(
    {} as LeagueService,
    {
      markForCheck: () => undefined,
    } as ChangeDetectorRef
  );
}

function gameIn(leagueName: string): Game {
  return { id: 1, league_name: leagueName } as unknown as Game;
}

describe('MatchReportStepThreeComponent: Torschützennamen auf der Kachel', () => {
  // Entscheidung des Verbandes vom 13.08.2026: Auch in Jugendligen sind die
  // Namen voreingestellt an, gewarnt wird nur. Dieselbe Linie wie bei der
  // Scorerliste, wo für U13 und jünger eine Empfehlung steht und keine Sperre.
  // Der Test hält die Entscheidung fest, damit sie nicht beiläufig kippt.
  it('nennt die Namen voreingestellt, auch in einer Jugendliga', () => {
    const component = build();
    component.game = gameIn('U15 Junioren Nord');

    expect(component.tileShowScorers).toBeTrue();
  });

  it('warnt in einer Jugendliga', () => {
    const component = build();
    component.game = gameIn('U15 Junioren Nord');

    expect(component.youthLeagueWarning).toBeTrue();
  });

  it('warnt in einer Erwachsenenliga nicht', () => {
    const component = build();
    component.game = gameIn('1. Bundesliga Herren');

    expect(component.youthLeagueWarning).toBeFalse();
  });

  it('kommt mit einem Spiel ohne Liganamen zurecht', () => {
    const component = build();
    component.game = {} as Game;

    expect(component.youthLeagueWarning).toBeFalse();
  });
});

describe('MatchReportStepThreeComponent: Unterschriften als Pflicht', () => {
  function withMissing(
    missing: string[] | undefined
  ): MatchReportStepThreeComponent {
    const component = build();
    component.additionalFields = {
      missing_signatures: missing,
    } as unknown as GameAdditionalFields;
    return component;
  }

  it('nennt die fehlenden Unterschriften mit den Bezeichnungen der Maske', () => {
    const component = withMissing(['home_captain_signed', 'referee2_signed']);

    expect(component.signaturesComplete).toBeFalse();
    expect(component.missingSignatureLabels).toEqual([
      'Heim',
      'Schiedsrichter 2',
    ]);
    expect(component.isSignatureMissing('home_captain_signed')).toBeTrue();
    expect(component.isSignatureMissing('time_keeper_signed')).toBeFalse();
  });

  it('schließt nicht ab, solange eine Unterschrift fehlt', () => {
    const component = withMissing(['referee1_signed']);
    const emitted = spyOn(component.closeMatchRecord, 'emit');

    component.handleFinalize();

    expect(emitted).not.toHaveBeenCalled();
  });

  it('lässt die SBK auch mit fehlenden Unterschriften abschließen', () => {
    const component = withMissing(['referee1_signed']);
    component.canOverrideSignatures = true;
    const emitted = spyOn(component.closeMatchRecord, 'emit');

    component.handleFinalize();

    expect(emitted).toHaveBeenCalled();
  });

  it('schließt ab, wenn alle Unterschriften abgehakt sind', () => {
    const component = withMissing([]);
    const emitted = spyOn(component.closeMatchRecord, 'emit');

    component.handleFinalize();

    expect(component.signaturesComplete).toBeTrue();
    expect(emitted).toHaveBeenCalled();
  });

  // Eine API vor der Pflichtregel liefert das Feld nicht. Dann sperrt die Maske
  // nichts, die Entscheidung bleibt bei der API.
  it('sperrt nichts, wenn die API keine fehlenden Unterschriften liefert', () => {
    const component = withMissing(undefined);

    expect(component.signaturesComplete).toBeTrue();
    expect(component.missingSignatureLabels).toEqual([]);
  });
});

describe('MatchReportStepThreeComponent: Beschreibung des besonderen Ereignisses', () => {
  function withSpecialEvent(
    description: string,
    missing: string[] = []
  ): MatchReportStepThreeComponent {
    const component = build();
    component.additionalFields = {
      missing_signatures: missing,
      special_event: true,
      special_event_string: description,
    } as unknown as GameAdditionalFields;
    return component;
  }

  it('schließt mit zu kurzer Beschreibung nicht ab', () => {
    const component = withSpecialEvent('x'.repeat(49));
    const emitted = spyOn(component.closeMatchRecord, 'emit');

    component.handleFinalize();

    expect(component.specialEventDescriptionMissing).toBeTrue();
    expect(emitted).not.toHaveBeenCalled();
  });

  it('schließt mit 50 Zeichen ab', () => {
    const component = withSpecialEvent('x'.repeat(50));
    const emitted = spyOn(component.closeMatchRecord, 'emit');

    component.handleFinalize();

    expect(emitted).toHaveBeenCalled();
  });

  it('lässt die SBK auch ohne Beschreibung abschließen und nennt es in der Rückfrage', () => {
    const component = withSpecialEvent('');
    component.canOverrideSignatures = true;
    const emitted = spyOn(component.closeMatchRecord, 'emit');

    component.handleFinalize();

    expect(emitted).toHaveBeenCalled();
    expect(component.overrideConfirmationContent).toContain(
      'besondere Ereignis'
    );
    expect(component.overrideConfirmationContent).not.toContain(
      'Unterschriften'
    );
  });
});

// Das Template selbst: welche Markierungen und welcher Knopf erscheinen. Die
// Kindkomponenten (Haken, Bestätigung, Knopf) stehen als unbekannte Elemente
// da (NO_ERRORS_SCHEMA); geprüft werden ihre Bindungen, nicht ihr Innenleben.
describe('MatchReportStepThreeComponent: Template der Unterschriften', () => {
  let fixture: ComponentFixture<MatchReportStepThreeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [MatchReportStepThreeComponent],
      providers: [{ provide: LeagueService, useValue: {} }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  function render(
    missing: string[],
    canOverride = false,
    specialEvent?: string,
    protest?: { parties: string[] }
  ): void {
    fixture = TestBed.createComponent(MatchReportStepThreeComponent);
    fixture.componentRef.setInput('game', {
      id: 1,
      ended: true,
      league_name: '1. Bundesliga Herren',
    } as unknown as Game);
    fixture.componentRef.setInput('additionalFields', {
      missing_signatures: missing,
      special_event: specialEvent !== undefined,
      special_event_string: specialEvent ?? '',
      protest: !!protest,
      protest_parties: protest?.parties ?? [],
      protest_party_options: [
        { key: 'guest', label: 'Gastteam' },
        { key: 'other', label: 'Andere' },
      ],
    } as unknown as GameAdditionalFields);
    fixture.componentRef.setInput('nextStatusOption', {
      key: 'match_record_closed',
      title: 'Kontrolle durch SBK',
      description: '',
      confirmationTitle: 'Spielbericht abschließen',
      confirmationContent: 'Soll die Eingabe wirklich abgeschlossen werden?',
      confirmationButton: 'Eingabe abschließen',
    });
    fixture.componentRef.setInput('canOverrideSignatures', canOverride);
    fixture.detectChanges();
  }

  function marked(): string[] {
    return fixture.debugElement
      .queryAll(By.css('[data-signature]'))
      .filter((el) => el.nativeElement.classList.contains('ring-red-400'))
      .map((el) => el.nativeElement.getAttribute('data-signature'));
  }

  function closeButtons() {
    return fixture.debugElement
      .queryAll(By.css('fb-button'))
      .filter((el) =>
        /abschließen/.test(el.nativeElement.textContent as string)
      );
  }

  it('markiert genau die fehlenden Haken und sperrt den Knopf für den Verein', () => {
    render(['home_captain_signed', 'referee1_signed']);

    expect(marked()).toEqual(['home_captain_signed', 'referee1_signed']);
    const hint = fixture.debugElement.query(
      By.css('[data-testid="signatures-missing"]')
    );
    expect(hint.nativeElement.textContent).toContain('Heim, Schiedsrichter 1');
    expect(fixture.debugElement.query(By.css('fb-confirmation'))).toBeNull();
    const buttons = closeButtons();
    expect(buttons.length).toBe(1);
    expect(buttons[0].properties['disabled']).toBeTrue();
  });

  it('bietet mit allen Haken den normalen Abschluss mit Rückfrage an', () => {
    render([]);

    expect(marked()).toEqual([]);
    expect(
      fixture.debugElement.query(By.css('[data-testid="signatures-missing"]'))
    ).toBeNull();
    const confirmation = fixture.debugElement.query(By.css('fb-confirmation'));
    expect(confirmation.properties['content']).toBe(
      'Soll die Eingabe wirklich abgeschlossen werden?'
    );
    expect(closeButtons()[0].properties['disabled']).toBeFalsy();
  });

  it('warnt die SBK, statt zu sperren, und fragt mit den fehlenden Namen nach', () => {
    render(['guest_captain_signed'], true);

    expect(marked()).toEqual(['guest_captain_signed']);
    const warning = fixture.debugElement.query(
      By.css('[data-testid="signatures-missing-sbk"]')
    );
    expect(warning.nativeElement.textContent).toContain(
      'Unterschriften fehlen: Gast.'
    );
    expect(warning.nativeElement.textContent).toContain(
      'Als SBK kannst du trotzdem abschließen.'
    );
    const confirmation = fixture.debugElement.query(By.css('fb-confirmation'));
    expect(confirmation.properties['content']).toContain('Gast');
    expect(confirmation.attributes['submitButtonTitle']).toBe(
      'Trotzdem abschließen'
    );
    expect(closeButtons()[0].properties['disabled']).toBeFalsy();
  });

  it('behält für den Verein den Hinweis, dass sich nichts nachtragen lässt', () => {
    render([]);

    expect(fixture.nativeElement.textContent).toContain(
      'lassen sie sich nicht mehr nachtragen'
    );
  });
  it('sperrt den Knopf für den Verein, solange das besondere Ereignis nicht beschrieben ist', () => {
    render([], false, 'zu kurz');

    const hint = fixture.debugElement.query(
      By.css('[data-testid="special-event-description-missing"]')
    );
    const text = hint.nativeElement.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('ist zu kurz: 7 von mindestens 50 Zeichen');
    expect(text).toContain('um mindestens 43 Zeichen');
    expect(
      fixture.debugElement.query(By.css('[data-testid="signatures-missing"]'))
    ).toBeNull();
    expect(fixture.debugElement.query(By.css('fb-confirmation'))).toBeNull();
    expect(closeButtons()[0].properties['disabled']).toBeTrue();
  });

  it('bietet mit ausreichender Beschreibung den normalen Abschluss an', () => {
    render([], false, 'x'.repeat(50));

    expect(
      fixture.debugElement.query(
        By.css('[data-testid="special-event-description-missing"]')
      )
    ).toBeNull();
    expect(closeButtons()[0].properties['disabled']).toBeFalsy();
  });

  it('warnt die SBK bei fehlender Beschreibung, statt zu sperren', () => {
    render([], true, '');

    expect(
      fixture.debugElement.query(
        By.css('[data-testid="special-event-description-missing-sbk"]')
      )
    ).not.toBeNull();
    expect(
      fixture.debugElement.query(
        By.css('[data-testid="signatures-missing-sbk"]')
      )
    ).toBeNull();
    expect(closeButtons()[0].nativeElement.textContent).toContain(
      'Spiel trotzdem abschließen'
    );
  });
  it('sagt ohne Beschreibung, dass noch nichts eingetragen ist', () => {
    render([], false, '   ');

    const text = fixture.debugElement
      .query(By.css('[data-testid="special-event-description-missing"]'))
      .nativeElement.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('angehakt, aber noch nicht beschrieben');
    expect(text).toContain('mindestens 50 Zeichen');
    expect(text).not.toContain('zu kurz');
  });
  it('sperrt den Abschluss für den Verein bei Protest ohne Partei', () => {
    render([], false, undefined, { parties: [] });

    expect(
      fixture.debugElement.query(
        By.css('[data-testid="protest-parties-missing"]')
      ).nativeElement.textContent
    ).toContain('keine Protestpartei ausgewählt');
    expect(fixture.debugElement.query(By.css('fb-confirmation'))).toBeNull();
    expect(closeButtons()[0].properties['disabled']).toBeTrue();
  });

  it('schließt mit gewählter Partei normal ab', () => {
    render([], false, undefined, { parties: ['other'] });

    expect(
      fixture.debugElement.query(
        By.css('[data-testid="protest-parties-missing"]')
      )
    ).toBeNull();
    expect(closeButtons()[0].properties['disabled']).toBeFalsy();
  });

  it('warnt die SBK bei Protest ohne Partei, statt zu sperren', () => {
    render([], true, undefined, { parties: [] });

    expect(
      fixture.debugElement.query(
        By.css('[data-testid="protest-parties-missing-sbk"]')
      )
    ).not.toBeNull();
    const confirmation = fixture.debugElement.query(By.css('fb-confirmation'));
    expect(confirmation.properties['content']).toContain(
      'keine Protestpartei ausgewählt'
    );
    expect(closeButtons()[0].nativeElement.textContent).toContain(
      'Spiel trotzdem abschließen'
    );
  });
});
