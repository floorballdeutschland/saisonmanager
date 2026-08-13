import { EMPTY, of, throwError } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { loadInitialTranslations } from './transloco-root';

// Der APP_INITIALIZER entscheidet, ob die Anwendung ueberhaupt startet: Lehnt
// das zurueckgegebene Promise ab, bricht Angular den Bootstrap ab und es bleibt
// eine leere Seite. Genau das passierte, wenn der Abruf der Sprachdatei ohne
// Wert abschloss (Sentry SAISONMANAGER-2K).
describe('loadInitialTranslations', () => {
  function translocoStub(load: () => unknown): TranslocoService {
    return {
      setActiveLang: jasmine.createSpy('setActiveLang'),
      load,
    } as unknown as TranslocoService;
  }

  it('liefert die geladenen Uebersetzungen', async () => {
    const translations = { hello: 'Hallo' };
    const transloco = translocoStub(() => of(translations));

    await expectAsync(loadInitialTranslations(transloco)()).toBeResolvedTo(
      translations
    );
  });

  // Der beobachtete Fall: Der Stream schliesst ohne Wert ab. catchError greift
  // hier NICHT, nur der defaultValue von firstValueFrom.
  it('startet auch, wenn der Abruf ohne Wert abschliesst', async () => {
    const transloco = translocoStub(() => EMPTY);

    await expectAsync(loadInitialTranslations(transloco)()).toBeResolvedTo(
      null
    );
  });

  it('startet auch, wenn der Abruf abbricht', async () => {
    const transloco = translocoStub(() =>
      throwError(() => new Error('offline'))
    );

    await expectAsync(loadInitialTranslations(transloco)()).toBeResolvedTo(
      null
    );
  });

  it('setzt die aktive Sprache, bevor geladen wird', async () => {
    const transloco = translocoStub(() => of({}));

    await loadInitialTranslations(transloco)();

    expect(transloco.setActiveLang).toHaveBeenCalled();
  });
});
