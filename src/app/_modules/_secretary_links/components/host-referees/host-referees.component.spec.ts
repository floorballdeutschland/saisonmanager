import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { SecretaryHostGame } from '@floorball/types';

import { HostRefereesComponent } from './host-referees.component';

describe('HostRefereesComponent', () => {
  let fixture: ComponentFixture<HostRefereesComponent>;

  const game = (
    overrides: Partial<SecretaryHostGame> = {}
  ): SecretaryHostGame => ({
    id: 1,
    game_number: '66',
    start_time: '14:00',
    home_team: 'UHC Weißenfels',
    guest_team: 'Berlin Rockets',
    referee_assignment: {
      status: 'published',
      referees: [
        { name: 'Jan Knap', guest: true, email: 'jan@example.org' },
        { name: 'Anna Pfiff', guest: false, email: 'anna@example.org' },
      ],
      coach: { name: 'Carl Coach', guest: false, email: 'carl@example.org' },
      club: null,
    },
    ...overrides,
  });

  const render = (games: SecretaryHostGame[]) => {
    fixture.componentRef.setInput('games', games);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const all = (el: HTMLElement, test: string) =>
    Array.from(el.querySelectorAll<HTMLElement>(`[data-test="${test}"]`));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [HostRefereesComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HostRefereesComponent);
  });

  it('nennt Schiedsrichter und Coach mit E-Mail als mailto-Link', () => {
    const el = render([game()]);

    const rows = all(el, 'host-person');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('Jan Knap');
    expect(rows[0].textContent).toContain('(Gast)');
    expect(rows[1].textContent).not.toContain('(Gast)');
    expect(rows[2].textContent).toContain('Coach:');
    const links = rows.map((r) => r.querySelector('a')?.getAttribute('href'));
    expect(links).toEqual([
      'mailto:jan@example.org',
      'mailto:anna@example.org',
      'mailto:carl@example.org',
    ]);
  });

  it('schreibt alle Personen des Spiels in einem Link an', () => {
    const el = render([game()]);

    expect(all(el, 'host-mail-all')[0].getAttribute('href')).toBe(
      'mailto:jan@example.org,anna@example.org,carl@example.org'
    );
  });

  it('nennt eine fehlende Adresse und lässt sie aus dem Sammellink', () => {
    const el = render([
      game({
        referee_assignment: {
          status: 'published',
          referees: [
            { name: 'Jan Knap', guest: true, email: null },
            { name: 'Anna Pfiff', guest: false, email: 'anna@example.org' },
          ],
          coach: null,
          club: null,
        },
      }),
    ]);

    expect(all(el, 'host-person')[0].textContent).toContain(
      'keine E-Mail hinterlegt'
    );
    expect(all(el, 'host-mail-all')[0].getAttribute('href')).toBe(
      'mailto:anna@example.org'
    );
  });

  it('zeigt bei vorläufiger Ansetzung niemanden', () => {
    const el = render([game({ referee_assignment: { status: 'tentative' } })]);

    expect(all(el, 'host-tentative').length).toBe(1);
    expect(all(el, 'host-person').length).toBe(0);
    expect(all(el, 'host-mail-all').length).toBe(0);
  });

  it('sagt, wenn noch niemand angesetzt ist', () => {
    const el = render([game({ referee_assignment: null })]);

    expect(all(el, 'host-none').length).toBe(1);
  });

  it('nennt bei einer Vereinsansetzung den stellenden Verein', () => {
    const el = render([
      game({
        referee_assignment: {
          status: 'published',
          referees: [],
          coach: null,
          club: 'SR-Verein Mitte',
        },
      }),
    ]);

    expect(all(el, 'host-club')[0].textContent).toContain('SR-Verein Mitte');
    expect(all(el, 'host-mail-all').length).toBe(0);
    expect(el.textContent).not.toContain('Niemand angesetzt');
  });

  it('nennt Anstoß, Begegnung und Spielnummer', () => {
    const text = all(render([game()]), 'host-game')[0].textContent ?? '';

    expect(text).toContain('14:00 Uhr');
    expect(text).toContain('UHC Weißenfels – Berlin Rockets');
    expect(text).toContain('#66');
  });
});
