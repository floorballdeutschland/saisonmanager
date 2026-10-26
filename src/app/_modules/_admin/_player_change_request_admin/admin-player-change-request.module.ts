import { NgModule } from '@angular/core';
import { AdminPlayerChangeRequestRoutingModule } from './admin-player-change-request-routing.module';
import { PlayerChangeRequestSharedModule } from './player-change-request-shared.module';

@NgModule({
  imports: [
    AdminPlayerChangeRequestRoutingModule,
    PlayerChangeRequestSharedModule,
  ],
})
export class AdminPlayerChangeRequestModule {}
