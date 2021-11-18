import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation
 } from '@angular/core';

@Component({
  selector: 'fb-sidebar',
  templateUrl: './sidebar.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {

  leagueNavigationMock: any[] = [
    {
      name: '1.FBL',
      route:'1-fbl'
    },
    {
      name: '1.FBL Damen',
      route:'1-fbl-damen'
    },
    {
      name: '2.FBL Ost',
      route:'2-fbl-ost'
    },
    {
      name: '2.FBL Nord-West',
      route:'2-fbl-nord-west'
    },
    {
      name: '2.FBL Süd-West',
      route:'2-fbl-sued-west'
    },
    {
      name: 'FD Pokal Herren',
      route:'fd-pokal-herren'
    },
    {
      name: 'FD Pokal Damen',
      route:'fd-pokal-damen'
    },
  ];
}
