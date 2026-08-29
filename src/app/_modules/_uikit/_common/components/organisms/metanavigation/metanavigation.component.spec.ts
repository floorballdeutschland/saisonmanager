import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MetanavigationComponent } from './metanavigation.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { CommonModule } from '@angular/common';
import { getTranslocoTestingModule, SessionService } from '@floorball/core';
import { BehaviorSubject } from 'rxjs';

// Die echten Sprachdateien, nicht der Transloco-Mock: Eine Umbenennung gegen
// die im Test selbst gesetzten Strings zu prüfen, wäre tautologisch.
import de from '../../../../../../../assets/i18n/de.json';
import en from '../../../../../../../assets/i18n/en.json';

describe('MetanavigationComponent', () => {
  let component: MetanavigationComponent;
  let fixture: ComponentFixture<MetanavigationComponent>;
  let currentUser$: BehaviorSubject<unknown>;

  // Die Navigation rendert nur eingeloggt; ohne Benutzer bleibt das Menü leer
  // und jede Aussage über Abschnitte wäre tautologisch wahr.
  const userWith = (permissions: Record<string, boolean>) => ({
    username: 'coach',
    permissions,
  });

  beforeEach(async () => {
    currentUser$ = new BehaviorSubject<unknown>(null);

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule({
          de: {
            'nav.section.referee': 'Schiedsrichterwesen',
            'nav.section.coaching': 'Coaching',
            'nav.myObservations': 'Meine Beobachtungen',
            'nav.myReceivedObservations': 'Mein Coaching-Feedback',
          },
        }),
      ],
      declarations: [MetanavigationComponent],
      providers: [
        {
          provide: SessionService,
          useValue: {
            currentUser$,
            isLoggedIn$: currentUser$.pipe(),
            logout: () => undefined,
          },
        },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MetanavigationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /** Der <nav>-Block, der auf die Überschrift mit diesem Text folgt. */
  const sectionAfter = (heading: string): Element | null => {
    const headings = Array.from(
      fixture.nativeElement.querySelectorAll('h2')
    ) as Element[];
    const match = headings.find((h) => h.textContent?.trim() === heading);
    return match?.nextElementSibling ?? null;
  };

  const linkHrefs = (section: Element | null) =>
    Array.from(section?.querySelectorAll('a') ?? []).map((a) =>
      a.getAttribute('href')
    );

  it('stellt die eigenen Beobachtungen in einen eigenen Abschnitt Coaching', () => {
    currentUser$.next(
      userWith({
        menu_item_referee_observations: true,
        menu_item_referee_profile: true,
      })
    );
    fixture.detectChanges();

    expect(linkHrefs(sectionAfter('Coaching'))).toEqual([
      '/schiedsrichter/meine-beobachtungen',
    ]);
    expect(linkHrefs(sectionAfter('Schiedsrichterwesen'))).not.toContain(
      '/schiedsrichter/meine-beobachtungen'
    );
  });

  it('laesst die erhaltenen Rueckmeldungen im Schiedsrichterwesen stehen', () => {
    currentUser$.next(userWith({ show_page_referee_observations: true }));
    fixture.detectChanges();

    expect(linkHrefs(sectionAfter('Schiedsrichterwesen'))).toContain(
      '/schiedsrichter/beobachtungen'
    );
    expect(sectionAfter('Coaching')).toBeNull();
  });

  it('beschriftet die erhaltenen Rueckmeldungen als Coaching-Feedback', () => {
    expect(de.nav.myReceivedObservations).toBe('Mein Coaching-Feedback');
    expect(en.nav.myReceivedObservations).toBe('My coaching feedback');
    expect(de.nav.section.coaching).toBe('Coaching');
    expect(en.nav.section.coaching).toBe('Coaching');
  });
});
