import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './admin-api-key-routing.module';

@Component({ template: '', standalone: true })
class StubComponent {}

// Die Website-Auswertung muss vor ':id/nutzung' stehen, sonst haelt der
// Router 'website' fuer eine Key-Id und die Seite zeigt nur den Ladefehler.
describe('AdminApiKeyRouting', () => {
  it('loest /website/nutzung als Website-Auswertung auf, nicht als Key', async () => {
    // Gleiche Reihenfolge und Daten, nur ohne die echten Ansichten.
    const stubbed: Routes = routes.map((r) => ({
      ...r,
      component: StubComponent,
    }));
    TestBed.configureTestingModule({ providers: [provideRouter(stubbed)] });
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/verwaltung/api-keys/website/nutzung');

    const route = harness.routeDebugElement?.injector.get(ActivatedRoute);
    expect(route?.snapshot.data['publicUsage']).toBeTrue();
    expect(route?.snapshot.paramMap.has('id')).toBeFalse();
  });
});
