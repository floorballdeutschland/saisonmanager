import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { provideRouter, RouterLink } from '@angular/router';
import { getTranslocoTestingModule } from '../../../../_core/_i18n/transloco-testing';
import { NotFoundComponent } from './not-found.component';

describe('NotFoundComponent', () => {
  let fixture: ComponentFixture<NotFoundComponent>;
  let meta: Meta;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [NotFoundComponent],
      imports: [getTranslocoTestingModule(), RouterLink],
      providers: [provideRouter([])],
    });
    meta = TestBed.inject(Meta);
    meta.removeTag("name='robots'");
    fixture = TestBed.createComponent(NotFoundComponent);
  });

  afterEach(() => meta.removeTag("name='robots'"));

  // nginx antwortet für jeden Pfad mit 200, ohne noindex wäre das ein Soft-404.
  it('setzt noindex, solange die Seite steht', () => {
    fixture.detectChanges();

    expect(meta.getTag("name='robots'")?.content).toBe('noindex');
  });

  it('nimmt noindex beim Verlassen wieder weg', () => {
    fixture.detectChanges();
    fixture.destroy();

    expect(meta.getTag("name='robots'")).toBeNull();
  });
});
