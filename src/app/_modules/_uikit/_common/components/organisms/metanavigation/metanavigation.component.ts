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
import { TranslocoService } from '@jsverse/transloco';
import {
  AppLanguage,
  AVAILABLE_LANGS,
  SessionService,
  VersionService,
} from '@floorball/core';

@Component({
  selector: 'fb-metanavigation',
  templateUrl: './metanavigation.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
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

  availableLangs = AVAILABLE_LANGS;
  activeLang$ = this._transloco.langChanges$;

  constructor(
    private _sessionService: SessionService,
    private _versionService: VersionService,
    private _transloco: TranslocoService,
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

  public switchLanguage(lang: AppLanguage) {
    if (this._transloco.getActiveLang() === lang) {
      return;
    }

    this._sessionService.setLanguage(lang).subscribe();
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
