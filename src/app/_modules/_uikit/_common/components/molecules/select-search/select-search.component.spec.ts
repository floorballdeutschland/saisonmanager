import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';

import { SelectSearchComponent } from './select-search.component';

@Component({
  template: `
    <fb-select-search
      [(ngModel)]="clubId"
      [items]="clubs"
      [resetLabel]="resetLabel"
      [resetValue]="resetValue"
      placeholder="Verein wählen"
    />
  `,
  standalone: false,
  // Eager, weil die Default-Strategie in Angular 22 dirty-getrackt ist: ohne
  // das würden Änderungen an den Host-Feldern nie in die Bindings laufen.
  changeDetection: ChangeDetectionStrategy.Eager,
})
class HostComponent {
  clubs: { id: number; name: string }[] = [
    { id: 1, name: 'Zehlendorfer Wespen' },
    { id: 2, name: 'Berlin Rockets' },
    { id: 3, name: 'ETV Hamburg' },
  ];
  clubId: number | null = null;
  resetLabel: string | null = 'Bitte wählen';
  resetValue: number | null = null;

  constructor(readonly cdr: ChangeDetectorRef) {}
}

describe('SelectSearchComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const input = (): HTMLInputElement =>
    fixture.nativeElement.querySelector('input');
  const options = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('li[role="option"]'));
  const optionTexts = (): string[] =>
    options().map((li) => li.textContent!.trim());

  const type = (value: string): void => {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const focus = (): void => {
    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
  };

  const keydown = (key: string): void => {
    input().dispatchEvent(new KeyboardEvent('keydown', { key }));
    fixture.detectChanges();
  };

  // Änderungen an Host-Feldern kommen nicht aus einem Event, die View muss
  // daher von Hand als dirty markiert werden, damit die Bindings laufen.
  const applyHostChanges = (): void => {
    host.cdr.markForCheck();
    fixture.detectChanges();
  };

  // NgModel schreibt den Wert erst in einem Microtask in die Komponente, daher
  // nach dem Setzen auf Stabilität warten.
  const setClubId = async (value: number | string | null): Promise<void> => {
    host.clubId = value as number | null;
    applyHostChanges();
    await fixture.whenStable();
    applyHostChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SelectSearchComponent, HostComponent],
      imports: [
        FormsModule,
        getTranslocoTestingModule({
          de: { common: { noResults: 'Keine Treffer' } },
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('bleibt geschlossen, bis das Feld fokussiert wird', () => {
    expect(options().length).toBe(0);
  });

  it('zeigt beim Fokus die vollständige Liste in übergebener Reihenfolge', () => {
    focus();

    // Erster Eintrag ist der Reset-Eintrag, der kein Verein ist.
    expect(optionTexts()).toEqual([
      'Bitte wählen',
      'Zehlendorfer Wespen',
      'Berlin Rockets',
      'ETV Hamburg',
    ]);
  });

  it('filtert ab dem ersten Zeichen unabhängig von Groß-/Kleinschreibung', () => {
    focus();
    type('ber');

    expect(optionTexts()).toEqual(['Berlin Rockets']);
  });

  it('findet Treffer auch in der Wortmitte', () => {
    focus();
    type('hamburg');

    expect(optionTexts()).toEqual(['ETV Hamburg']);
  });

  it('meldet keinen Treffer statt einer leeren Liste', () => {
    focus();
    type('gibtesnicht');

    expect(options().length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Keine Treffer');
  });

  it('schreibt die Auswahl per ngModel zurück und zeigt den Namen an', () => {
    focus();
    type('rockets');
    options()[0].dispatchEvent(new MouseEvent('mousedown'));
    fixture.detectChanges();

    expect(host.clubId).toBe(2);
    expect(input().value).toBe('Berlin Rockets');
    expect(options().length).toBe(0);
  });

  it('wählt den markierten Eintrag per Pfeiltaste und Enter', () => {
    focus();
    type('e');
    keydown('ArrowDown');
    keydown('Enter');

    expect(host.clubId).toBe(2);
  });

  it('leert die Auswahl über den Reset-Eintrag', async () => {
    await setClubId(3);
    expect(input().value).toBe('ETV Hamburg');

    focus();
    options()[0].dispatchEvent(new MouseEvent('mousedown'));
    fixture.detectChanges();

    expect(host.clubId).toBeNull();
    expect(input().value).toBe('');
  });

  it('zeigt den Namen auch, wenn die Liste erst nach dem Wert ankommt', async () => {
    host.clubs = [];
    await setClubId(2);
    expect(input().value).toBe('');

    host.clubs = [{ id: 2, name: 'Berlin Rockets' }];
    applyHostChanges();

    expect(input().value).toBe('Berlin Rockets');
  });

  it('erkennt den gewählten Eintrag auch bei einer ID als String', async () => {
    await setClubId('2');

    expect(input().value).toBe('Berlin Rockets');
  });

  it('verwirft die Sucheingabe beim Verlassen des Feldes', async () => {
    await setClubId(1);

    focus();
    type('ham');
    input().dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(host.clubId).toBe(1);
    expect(input().value).toBe('Zehlendorfer Wespen');
    expect(options().length).toBe(0);
  });

  it('erreicht den Reset-Eintrag mit der Tastatur', async () => {
    await setClubId(2);

    focus();
    // Der gewählte Eintrag ist markiert; von dort nach oben bis zum
    // Reset-Eintrag oberhalb des ersten Vereins.
    keydown('ArrowUp');
    keydown('ArrowUp');
    keydown('Enter');

    expect(host.clubId).toBeNull();
  });

  it('bleibt beim Reset-Eintrag stehen, statt darüber hinaus zu laufen', () => {
    focus();
    keydown('ArrowUp');
    keydown('ArrowUp');
    keydown('ArrowUp');
    keydown('Enter');

    expect(host.clubId).toBeNull();
  });

  it('schreibt beim Reset den konfigurierten Leerwert', async () => {
    host.resetValue = 0;
    applyHostChanges();
    await setClubId(3);

    focus();
    options()[0].dispatchEvent(new MouseEvent('mousedown'));
    fixture.detectChanges();

    expect(host.clubId).toBe(0);
    expect(input().value).toBe('');
  });

  it('wählt ohne sichtbaren Reset-Eintrag per Enter nichts aus', () => {
    host.resetLabel = null;
    applyHostChanges();

    focus();
    keydown('ArrowUp');
    keydown('Enter');

    // Markierung steht auf dem ersten Verein, nicht auf einem Leer-Eintrag.
    expect(host.clubId).toBe(1);
  });

  it('bietet ohne resetLabel keinen Leer-Eintrag an', () => {
    host.resetLabel = null;
    applyHostChanges();

    focus();

    expect(optionTexts()).toEqual([
      'Zehlendorfer Wespen',
      'Berlin Rockets',
      'ETV Hamburg',
    ]);
  });
});
