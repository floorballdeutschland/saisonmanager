import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '@floorball/core';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'fb-metanavigation',
  templateUrl: './metanavigation.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetanavigationComponent implements OnInit {
  @Output()
  closeHandler = new EventEmitter<void>();

  isLoggedIn$ = this._sessionService.isLoggedIn$;
  currentUser$ = this._sessionService.currentUser$;

  permissions: { [key: string]: boolean } = {};
  username = '';

  archiveMode = environment.archiveMode;

  constructor(
    private _sessionService: SessionService,
    private router: Router
  ) {}

  public ngOnInit() {
    this.currentUser$.subscribe({
      next: (user) => {
        if (user) {
          this.permissions = user.permissions;
          this.username = user.username;
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
    this.router.navigate(['/']);

    return false;
  }

  public closeMenu() {
    this.closeHandler.emit();
  }
}
