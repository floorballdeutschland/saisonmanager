import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PublicAssociationHostRoutingModule } from './public-association-host-routing.module';

import * as Views from './_views';
import { LeagueHostComponent } from './_views/league-host/league-host.component';

@NgModule({
  imports: [CommonModule, PublicAssociationHostRoutingModule],
  declarations: [Views.AssociationHostComponent, LeagueHostComponent],
})
export class PublicAssociationHostModule {}
