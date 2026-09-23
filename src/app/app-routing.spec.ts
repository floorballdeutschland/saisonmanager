import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RoutesRecognized,
} from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { AssociationService } from '@floorball/core';
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

      // Die Verbandsprüfung des Hosts liest die Kürzel aus init.json. Der
      // Service lädt sie einmal und hält sie danach vor, wie im Betrieb.
      TestBed.inject(AssociationService);
      TestBed.inject(HttpTestingController)
        .expectOne((req) => req.url.endsWith('init.json'))
        .flush({
          game_operations: [
            { id: 1, name: 'Floorball Deutschland', path: 'fd' },
          ],
          seasons: [],
          current_season_id: 18,
        });
    });

    async function recognizedLeaf(
      url: string
    ): Promise<ActivatedRouteSnapshot> {
      const router = TestBed.inject(Router);
      const recognized = firstValueFrom(
        router.events.pipe(filter((e) => e instanceof RoutesRecognized))
      );
      router.navigateByUrl(url).catch(() => undefined);

      let leaf: ActivatedRouteSnapshot = (await recognized).state.root;
      while (leaf.firstChild) {
        leaf = leaf.firstChild;
      }
      return leaf;
    }

    // Die ersten beiden Pfade stammen aus Sentry (#455): ein Unterpfad, den es
    // nie gab, und eine Streamadresse, die als Pfad im Spielbericht stand. Die
    // übrigen nahm früher der Spielbetriebs-Host ab, als Verband mit leerem
    // Rahmen bzw. als Übersicht einer Liga, die es nicht gibt.
    for (const url of [
      '/fd/2447-1-fbl-herren/spielplan',
      '/fd/1524-regionalligameisterschaft/spiel/www.twitch.tv/floorballtsc',
      '/gibtsnicht',
      '/verwaltung/gibtsnicht',
      '/gibts/nicht',
      '/fd/gibtsnicht',
      '/gibtsnicht/2447-1-fbl-herren',
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

    // Gegenprobe mit echten Verbandspfaden, darunter die Formen aus
    // prerender-routes.txt. Geprüft wird nur die Erkennung, nicht das Rendern,
    // das echte Daten bräuchte.
    for (const [url, component] of [
      ['/fd', 'AssociationHostComponent'],
      ['/fd/2447', 'OverviewComponent'],
      ['/fd/2447-1-fbl-herren', 'OverviewComponent'],
      ['/fd/2447-1-fbl-herren/tabelle', 'RankingComponent'],
      ['/fd/2447-1-fbl-herren/scorer', 'ScorerComponent'],
      ['/fd/2447-1-fbl-herren/spiel/123', 'MatchComponent'],
    ]) {
      it(`erkennt weiterhin den Spielbetrieb: ${url}`, async () => {
        const leaf = await recognizedLeaf(url);

        expect(leaf.component).not.toBe(NotFoundComponent);
        expect(leaf.component?.name).toBe(component);
      });
    }
  });
});
