import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';
import {
  API_DAILY_REQUEST_GUIDELINE,
  API_RATE_LIMIT_PER_MINUTE,
  API_TERMS_VERSION,
} from '../../api-terms-version';

/**
 * Volltext der Nutzungsvereinbarung für die Saisonmanager-API.
 *
 * Der Rechtstext steht bewusst als deutsches Markup im Template und nicht in den
 * Übersetzungsdateien: Verbindlich ist allein die deutsche Fassung (§ 14), eine
 * übersetzte Vereinbarung wäre irreführend. Über Transloco laufen nur die
 * Bedienelemente und der Hinweis für englischsprachige Leser.
 *
 * Bei jeder inhaltlichen Änderung ist API_TERMS_VERSION hier und ApiTerms::VERSION
 * in der API mitzuziehen, sonst dokumentieren die Anträge die falsche Fassung.
 */
@Component({
  templateUrl: './api-access-terms.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ApiAccessTermsComponent {
  readonly version = API_TERMS_VERSION;
  readonly rateLimitPerMinute = API_RATE_LIMIT_PER_MINUTE;
  /** Tausenderpunkt wie im Fließtext, nicht als Zahl aus der Locale. */
  readonly dailyRequestGuideline =
    API_DAILY_REQUEST_GUIDELINE.toLocaleString('de-DE');
}
