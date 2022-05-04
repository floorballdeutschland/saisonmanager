import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';
import { SessionService } from '@floorball/core';

@Component({
  selector: 'fb-metanavigation',
  templateUrl: './metanavigation.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetanavigationComponent {
  isLoggedIn$ = this._sessionService.isLoggedIn$;

  constructor(private _sessionService: SessionService) {}

  public logout() {
    this._sessionService.logout();
  }
}
