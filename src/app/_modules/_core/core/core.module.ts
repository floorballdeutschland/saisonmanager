import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionService, NotificationService } from '../_services';

@NgModule({
  declarations: [],
  imports: [CommonModule],
  exports: [SessionService, NotificationService],
})
export class CoreModule {}
