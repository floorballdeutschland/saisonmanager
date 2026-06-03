import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { SessionService, VersionService } from '@floorball/core';

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
  version$ = this._versionService.version$;
  currentRelease$ = this._versionService.changelog$.pipe(
    map((entries) => {
      const entry = entries?.[0];
      if (!entry) return null;
      return { ...entry, sections: Object.keys(entry.changes) };
    })
  );

  permissions: { [key: string]: boolean } = {};
  username = '';

  constructor(
    private _sessionService: SessionService,
    private _versionService: VersionService,
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
    this.router.navigate(['/login']);

    return false;
  }

  public closeMenu() {
    this.closeHandler.emit();
  }
}
