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
import { config, filter, firstValueFrom, tap } from 'rxjs';
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
    let httpMock: HttpTestingController;

    const initRequest = (req: { url: string }) => req.url.endsWith('init.json');

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [getTranslocoTestingModule()],
        providers: [
          provideRouter(routes),
          provideHttpClient(),
          provideHttpClientTesting(),
        ],
      });
      httpMock = TestBed.inject(HttpTestingController);
    });

    // Stellt sicher, dass die Verbandsprüfung keinen eigenen init.json-Request
    // stellt, solange die erste Antwort nicht gescheitert ist.
    afterEach(() => httpMock.verify());

    // Die Verbandsprüfung des Hosts liest die Kürzel aus init.json. Der
    // Service lädt sie einmal und hält sie danach vor, wie im Betrieb.
    function answerInit(): void {
      TestBed.inject(AssociationService);
      httpMock.expectOne(initRequest).flush({
        game_operations: [{ id: 1, name: 'Floorball Deutschland', path: 'fd' }],
        seasons: [],
        current_season_id: 18,
      });
    }

    // Erkennung ohne Aktivierung: Die Navigation wird nach RoutesRecognized
    // abgebrochen, damit keine Seite rendert und eigene Requests stellt, die
    // httpMock.verify() dann anmahnen würde.
    async function recognizedLeaf(
      url: string,
      whileWaiting?: () => Promise<void>
    ): Promise<ActivatedRouteSnapshot> {
      const router = TestBed.inject(Router);
      const recognized = firstValueFrom(
        router.events.pipe(
          filter((e) => e instanceof RoutesRecognized),
          tap(() => router.currentNavigation()?.abort())
        )
      );
      router.navigateByUrl(url).catch(() => undefined);
      await whileWaiting?.();

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
        answerInit();
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
        answerInit();
        const leaf = await recognizedLeaf(url);

        expect(leaf.component).not.toBe(NotFoundComponent);
        expect(leaf.component?.name).toBe(component);
      });
    }

    // Rückfall: Antwortet init.json nicht, entscheidet die Prüfung für den Host
    // wie vor der Verbandsprüfung, statt eine 404 zu zeigen.
    describe('wenn init.json scheitert', () => {
      let previousHandler: typeof config.onUnhandledError;

      // Die internen Abos des AssociationService haben keinen Fehlerzweig;
      // rxjs würfe den Fehler sonst asynchron in einen fremden Test.
      beforeEach(() => {
        previousHandler = config.onUnhandledError;
        config.onUnhandledError = () => undefined;
      });
      afterEach(() => (config.onUnhandledError = previousHandler));

      it('überlässt /gibtsnicht dem Spielbetriebs-Host', async () => {
        TestBed.inject(AssociationService);
        httpMock
          .expectOne(initRequest)
          .flush(null, { status: 0, statusText: 'Unknown Error' });

        // Nach dem Fehler hält shareReplay nichts vor, die Prüfung stellt einen
        // neuen Request. Auch der scheitert.
        const leaf = await recognizedLeaf('/gibtsnicht', async () => {
          let retry = httpMock.match(initRequest);
          for (let i = 0; retry.length === 0 && i < 50; i++) {
            await new Promise((resolve) => setTimeout(resolve));
            retry = httpMock.match(initRequest);
          }
          expect(retry.length).toBe(1);
          retry.forEach((req) =>
            req.flush(null, { status: 0, statusText: 'Unknown Error' })
          );
        });

        expect(leaf.component?.name).toBe('AssociationHostComponent');
      });
    });
  });
});
