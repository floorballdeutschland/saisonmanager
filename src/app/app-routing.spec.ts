import { Type } from '@angular/core';
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

  it('lädt den Spielbetriebs-Host als letzte Route', async () => {
    await expectAsync(moduleNameOf(routes.length - 1)).toBeResolvedTo(
      'PublicAssociationHostModule'
    );
  });

  it('registriert die Bestätigungsseiten vor dem Spielbetriebs-Host', async () => {
    const names = await Promise.all(
      routes.slice(0, -1).map((_, index) => moduleNameOf(index).catch(() => ''))
    );

    expect(names).toContain('PublicEmailConfirmationModule');
    expect(names).toContain('PublicTransferConfirmationModule');
  });
});
