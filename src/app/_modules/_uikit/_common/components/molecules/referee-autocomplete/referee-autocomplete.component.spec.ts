import { NO_ERRORS_SCHEMA, SimpleChange } from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { RefereeAutocompleteComponent } from './referee-autocomplete.component';
import { RefereeService } from '@floorball/core';
import { RefereeEntry } from '@floorball/types';

const schroeder: RefereeEntry = {
  lizenznummer: 5605,
  nachname: 'Schröder',
  vorname: 'Tobias',
} as RefereeEntry;

const trosien: RefereeEntry = {
  lizenznummer: 5824,
  nachname: 'Trosien',
  vorname: 'Max',
} as RefereeEntry;

describe('RefereeAutocompleteComponent', () => {
  let component: RefereeAutocompleteComponent;
  let fixture: ComponentFixture<RefereeAutocompleteComponent>;
  let searchCalls: string[];

  beforeEach(async () => {
    searchCalls = [];

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [RefereeAutocompleteComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(RefereeAutocompleteComponent);
    component = fixture.componentInstance;

    spyOn(TestBed.inject(RefereeService), 'search').and.callFake(
      (q: string) => {
        searchCalls.push(q);
        return of([schroeder]);
      }
    );

    fixture.detectChanges();
  });

  // Die Anzeige muss dem Input folgen, nicht nur dem Klick in der
  // Vorschlagsliste. Nimmt die Elternkomponente die Auswahl zurueck -- etwa weil
  // das Speichern gescheitert ist --, blieb vorher der Name samt gruenem Rahmen
  // stehen und behauptete einen Schiedsrichter, den das Spiel nicht hat.
  describe('Anzeige folgt dem Input', () => {
    function setSelection(
      previous: RefereeEntry | null,
      next: RefereeEntry | null
    ) {
      component.selectedReferee = next;
      component.ngOnChanges({
        selectedReferee: new SimpleChange(previous, next, false),
      });
    }

    it('leert das Feld, wenn die Auswahl zurueckgenommen wird', () => {
      component.select(schroeder);
      expect(component.query).toContain('Schröder');

      setSelection(schroeder, null);

      expect(component.query).toBe('');
    });

    it('zeigt einen von aussen gesetzten Schiedsrichter an', () => {
      setSelection(null, trosien);

      expect(component.query).toContain('Trosien');
      expect(component.query).toContain('5824');
    });

    // Ohne diese Wache raeumte jede andere Input-Aenderung das Feld mit.
    it('ruehrt das Feld nicht an, wenn sich etwas anderes aendert', () => {
      component.select(schroeder);
      const vorher = component.query;

      component.ngOnChanges({
        placeholder: new SimpleChange('a', 'b', false),
      });

      expect(component.query).toBe(vorher);
    });

    // Eine Schreibweise: Vorher zeigte ngOnInit den Namen ohne Lizenznummer und
    // onBlur mit -- der Text sprang beim ersten Verlassen des Feldes.
    it('zeigt dieselbe Schreibweise wie nach dem Verlassen des Feldes', () => {
      setSelection(null, schroeder);
      const nachInput = component.query;

      component.onBlur();

      expect(nachInput).toContain('(5605)');
    });
  });

  // Vorher stand hier distinctUntilChanged hinter debounceTime: Wer denselben
  // Namen erneut eintippte, dessen Eingabe wurde verworfen, es kam nie eine
  // Antwort, und `loading` blieb dauerhaft stehen. Mit dem Spinner verschwand
  // auch das Kreuz zum Leeren (Vorlage: `@if (query && !loading)`) -- das Feld
  // war ohne Neuladen der Seite nicht mehr zu bedienen. Das ist der einzige
  // Wiederholungsweg, seit der Speichern-Knopf entfallen ist.
  it('sucht dieselbe Eingabe erneut und laesst den Spinner nicht stehen', fakeAsync(() => {
    component.onInput('Schröder');
    tick(250);
    expect(searchCalls).toEqual(['Schröder']);
    expect(component.loading).toBeFalse();

    component.onInput('Schröder');
    tick(250);

    expect(searchCalls).toEqual(['Schröder', 'Schröder']);
    expect(component.loading).toBeFalse();

    component.ngOnDestroy();
  }));

  it('sucht nicht bei leerer Eingabe', fakeAsync(() => {
    component.onInput('   ');
    tick(250);

    expect(searchCalls).toEqual([]);
    expect(component.loading).toBeFalse();

    component.ngOnDestroy();
  }));
});
