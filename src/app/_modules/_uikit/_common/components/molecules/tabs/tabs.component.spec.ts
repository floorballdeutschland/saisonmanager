import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { TabDirective } from './tab.directive';
import { TabsComponent } from './tabs.component';

@Component({
  template: `
    <fb-tabs (activeChange)="changes.push($event)">
      <ng-template fbTab="eins" fbTabLabel="Eins">Inhalt eins</ng-template>
      <ng-template fbTab="zwei" fbTabLabel="Zwei" [fbTabBadge]="badge">
        <span data-testid="zwei-inhalt">Inhalt zwei</span>
      </ng-template>
      @if (showDrei) {
        <ng-template fbTab="drei" fbTabLabel="Drei" [fbTabInvalid]="invalid"
          >Inhalt drei</ng-template
        >
      }
    </fb-tabs>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
class HostComponent {
  changes: string[] = [];
  showDrei = true;
  invalid = false;
  badge: number | null = null;

  constructor(readonly cdr: ChangeDetectorRef) {}
}

describe('TabsComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let router: Router;

  async function setup(url = '/'): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [CommonModule, getTranslocoTestingModule()],
      declarations: [HostComponent, TabsComponent, TabDirective],
      providers: [provideRouter([{ path: '**', component: HostComponent }])],
    }).compileComponents();
    router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function panelText(): string {
    return fixture.debugElement
      .query(By.css('[role="tabpanel"]'))
      .nativeElement.textContent.trim();
  }

  function tab(id: string): HTMLButtonElement {
    return fixture.debugElement.query(By.css(`[data-testid="tab-${id}"]`))
      .nativeElement;
  }

  it('zeigt ohne Parameter den ersten Reiter und rendert nur ihn', async () => {
    await setup();
    expect(panelText()).toBe('Inhalt eins');
    expect(
      fixture.debugElement.queryAll(By.css('[role="tabpanel"]')).length
    ).toBe(1);
    expect(tab('eins').getAttribute('aria-selected')).toBe('true');
    expect(host.changes).toEqual(['eins']);
  });

  it('öffnet den Reiter aus dem Query-Parameter', async () => {
    await setup('/seite?reiter=zwei');
    expect(panelText()).toBe('Inhalt zwei');
  });

  it('fällt bei unbekannter Kennung auf den ersten Reiter zurück', async () => {
    await setup('/seite?reiter=gibtsnicht');
    expect(panelText()).toBe('Inhalt eins');
  });

  it('schreibt den Reiter beim Klick in die URL und behält andere Parameter', async () => {
    await setup('/seite?saison=17');
    tab('zwei').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/seite?saison=17&reiter=zwei');
    expect(panelText()).toBe('Inhalt zwei');
    expect(host.changes).toEqual(['eins', 'zwei']);
  });

  it('nimmt den Parameter beim ersten Reiter wieder aus der URL', async () => {
    await setup('/seite?reiter=zwei');
    tab('eins').click();
    await fixture.whenStable();
    expect(router.url).toBe('/seite');
  });

  it('folgt einer Navigation von außen', async () => {
    await setup();
    await router.navigateByUrl('/seite?reiter=drei');
    fixture.detectChanges();
    expect(panelText()).toBe('Inhalt drei');
  });

  it('wechselt auf den ersten Reiter, wenn der aktive wegfällt', async () => {
    await setup('/seite?reiter=drei');
    host.showDrei = false;
    host.cdr.markForCheck();
    fixture.detectChanges();
    expect(
      fixture.debugElement.query(By.css('[data-testid="tab-drei"]'))
    ).toBeNull();
    expect(panelText()).toBe('Inhalt eins');
  });

  it('zeigt Zähler und Fehlermarkierung', async () => {
    await setup();
    host.badge = 3;
    host.invalid = true;
    host.cdr.markForCheck();
    fixture.detectChanges();
    expect(tab('zwei').textContent).toContain('3');
    expect(tab('drei').classList).toContain('!text-red-600');
  });

  it('wandert mit den Pfeiltasten', async () => {
    await setup();
    tab('eins').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft' })
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(panelText()).toBe('Inhalt drei');
    expect(document.activeElement).toBe(tab('drei'));
  });
});
