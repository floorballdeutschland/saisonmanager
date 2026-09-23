import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RoutesRecognized,
} from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { RouterTestingHarness } from '@angular/router/testing';
import { getTranslocoTestingModule } from './_modules/_core/_i18n/transloco-testing';
import { NotFoundComponent } from './_modules/_public/_not_found/views';
import { routes } from './app-routing.module';

// Der Spielbetriebs-Host matcht mit ':association' jedes erste URL-Segment und
// gilt auch dann als getroffen, wenn danach nichts mehr übrig ist – die Seite
// bleibt dann leer (nur der Host-Rahmen ohne Kind-Route). Jede konkrete
// Ein-Segment-Route (z. B. /email-bestaetigen, /transfer-bestaetigung) muss
// deshalb davor stehen.
describe('App-Routing', () => {
  async function moduleNameOf(index: number): Promise<string> {
    const load = routes[index].loadChildren as () => Promise<Type<unknown>>;
    const loaded = await load();

    return loaded.name;
  }

  it('lädt die 404-Seite als letzte Route', async () => {
    await expectAsync(moduleNameOf(routes.length - 1)).toBeResolvedTo(
      'PublicNotFoundModule'
    );
  });

  it('lädt den Spielbetriebs-Host direkt vor der 404-Seite', async () => {
    await expectAsync(moduleNameOf(routes.length - 2)).toBeResolvedTo(
      'PublicAssociationHostModule'
    );
  });

  it('registriert die Bestätigungsseiten vor dem Spielbetriebs-Host', async () => {
    const names = await Promise.all(
      routes.slice(0, -2).map((_, index) => moduleNameOf(index).catch(() => ''))
    );

    expect(names).toContain('PublicEmailConfirmationModule');
    expect(names).toContain('PublicTransferConfirmationModule');
    expect(names).toContain('PublicChecklistVetoModule');
  });

  it('registriert den API-Zugang vor dem Spielbetriebs-Host', async () => {
    const names = await Promise.all(
      routes.slice(0, -2).map((_, index) => moduleNameOf(index).catch(() => ''))
    );

    expect(names).toContain('PublicApiAccessModule');
  });

  describe('unbekannte Pfade', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [getTranslocoTestingModule()],
        providers: [
          provideRouter(routes),
          provideHttpClient(),
          provideHttpClientTesting(),
        ],
      });
    });

    // Die Pfade stammen aus Sentry (#455): ein Unterpfad, den es nie gab, und
    // eine Streamadresse, die als Pfad im Spielbericht stand.
    for (const url of [
      '/fd/2447-1-fbl-herren/spielplan',
      '/fd/1524-regionalligameisterschaft/spiel/www.twitch.tv/floorballtsc',
    ]) {
      it(`landen auf der 404-Seite: ${url}`, async () => {
        const harness = await RouterTestingHarness.create();
        const component = await harness.navigateByUrl(url, NotFoundComponent);

        expect(component).toBeInstanceOf(NotFoundComponent);
        expect(harness.routeNativeElement?.textContent).toContain(
          'notFound.title'
        );
      });
    }

    // Gegenprobe: Bekannte tiefe Pfade des Spielbetriebs erreichen die
    // 404-Seite nicht. Geprüft wird nur die Erkennung, nicht das Rendern, das
    // echte Daten bräuchte.
    for (const url of [
      '/fd/2447-1-fbl-herren/tabelle',
      '/fd/2447-1-fbl-herren/spiel/123',
    ]) {
      it(`erkennt weiterhin den Spielbetrieb: ${url}`, async () => {
        const router = TestBed.inject(Router);
        const recognized = firstValueFrom(
          router.events.pipe(filter((e) => e instanceof RoutesRecognized))
        );
        router.navigateByUrl(url).catch(() => undefined);

        let leaf: ActivatedRouteSnapshot = (await recognized).state.root;
        while (leaf.firstChild) {
          leaf = leaf.firstChild;
        }

        expect(leaf.component).toBeDefined();
        expect(leaf.component).not.toBe(NotFoundComponent);
      });
    }

    // Ist-Stand, keine Wunschvorstellung: Ein- und Zwei-Segment-Pfade nimmt
    // der Spielbetriebs-Host über ':association' bzw. ':leagueId' ab, bevor
    // die 404-Seite an die Reihe kommt. /verwaltung/gibtsnicht zeigt deshalb
    // die Ligaübersicht einer „Liga" gibtsnicht. Prüft der Host künftig den
    // Verband (canMatch), muss dieser Test auf die 404-Seite umgestellt werden.
    for (const url of ['/verwaltung/gibtsnicht', '/gibts/nicht']) {
      it(`überlässt zwei Segmente dem Spielbetriebs-Host: ${url}`, async () => {
        const router = TestBed.inject(Router);
        const recognized = firstValueFrom(
          router.events.pipe(filter((e) => e instanceof RoutesRecognized))
        );
        router.navigateByUrl(url).catch(() => undefined);

        let leaf: ActivatedRouteSnapshot = (await recognized).state.root;
        while (leaf.firstChild) {
          leaf = leaf.firstChild;
        }

        expect(leaf.component?.name).toBe('OverviewComponent');
        expect(leaf.parent?.paramMap.has('leagueId')).toBeTrue();
      });
    }
  });
});
