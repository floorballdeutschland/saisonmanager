import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NavigationError, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AppComponent } from './app.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NotificationService } from '@floorball/core';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [AppComponent],
    })
      .overrideTemplate(AppComponent, '')
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  describe('Lazy-Load-Fehler', () => {
    let events$: Subject<unknown>;
    let errorSpy: jasmine.Spy;

    beforeEach(() => {
      events$ = new Subject<unknown>();
      TestBed.overrideProvider(Router, {
        useValue: { events: events$.asObservable() },
      });
      errorSpy = spyOn(TestBed.inject(NotificationService), 'error');
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges(); // ngOnInit
    });

    it('zeigt bei fehlgeschlagenem Modul-Nachladen eine Fehlermeldung', () => {
      events$.next(
        new NavigationError(
          1,
          '/verwaltung/ligen',
          new TypeError(
            'Failed to fetch dynamically imported module: https://example.org/chunk-x.js'
          )
        )
      );

      expect(errorSpy).toHaveBeenCalledWith(
        jasmine.stringContaining('konnte nicht geladen werden'),
        jasmine.objectContaining({ autoClose: false })
      );
    });

    it('meldet andere NavigationErrors nicht', () => {
      events$.next(
        new NavigationError(
          1,
          '/gibt-es-nicht',
          new Error("Cannot match any routes. URL Segment: 'gibt-es-nicht'")
        )
      );

      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
