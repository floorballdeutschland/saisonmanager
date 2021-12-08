import { ThrowStmt } from '@angular/compiler';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { NavigationEnd, Router, RouterEvent } from '@angular/router';
import { GameOperation } from '@floorball/types';
import { Subject } from 'rxjs';

@Component({
  selector: 'fb-mobile-header',
  templateUrl: './mobile-header.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileHeaderComponent implements OnInit, OnDestroy {
  @Input()
  association?: GameOperation | null;

  status = false;

  routerEventSubscription: any;
  private destroy$: Subject<boolean> = new Subject<boolean>();

  constructor(protected router: Router) {}

  ngOnInit(): void {
    this.routerEventSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd && this.status == true) {
        this.status = !this.status;
        console.log(this.status);
      }
    });
  }

  openCloseMenu() {
    this.status = !this.status;
  }

  ngOnDestroy(): void {
    this.routerEventSubscription.unsubscribe();
    this.destroy$.next(true);
  }
}
