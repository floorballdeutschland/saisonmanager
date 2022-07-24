import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '@floorball/core';
import { User } from 'src/app/_models';

@Component({
  selector: 'fb-metanavigation',
  templateUrl: './metanavigation.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetanavigationComponent implements OnInit {
  isLoggedIn$ = this._sessionService.isLoggedIn$;
  currentUser$ = this._sessionService.currentUser$;

  permissions: { [key: string]: any } = {};

  constructor(
    private _sessionService: SessionService,
    private router: Router
  ) {}

  public ngOnInit() {
    this.currentUser$.subscribe({
      next: (user) => {
        if (user) {
          this.permissions = user.permissions;
        }
      },
    });
  }

  public showItem(key: string) {
    if (this.permissions[key]) {
      return this.permissions[key];
    }

    return false;
  }

  public logout() {
    this._sessionService.logout();

    setTimeout(() => {
      this.router.navigate(['/']);
    }, 500);

    return false;
  }
}
