import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollapsibleComponent } from './collapsible.component';

describe('CollapsibleComponent', () => {
  let fixture: ComponentFixture<CollapsibleComponent>;
  let component: CollapsibleComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CollapsibleComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CollapsibleComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Weitere Filter');
    fixture.detectChanges();
  });

  function details(): HTMLDetailsElement {
    return fixture.nativeElement.querySelector('details');
  }

  it('ist zu Beginn zugeklappt', () => {
    expect(details().open).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Weitere Filter');
  });

  it('meldet das Aufklappen', () => {
    const seen: boolean[] = [];
    component.openChange.subscribe((v) => seen.push(v));
    details().open = true;
    details().dispatchEvent(new Event('toggle'));
    expect(seen).toEqual([true]);
    expect(component.open).toBeTrue();
  });

  it('zeigt den Zähler nur, wenn er größer als 0 ist', () => {
    fixture.componentRef.setInput('count', 0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('summary span')).toBeNull();
    fixture.componentRef.setInput('count', 2);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('summary span').textContent
    ).toBe('2');
  });
});
