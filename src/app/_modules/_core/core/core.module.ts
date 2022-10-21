import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, SessionService } from '../_services';

@NgModule({
  declarations: [],
  imports: [CommonModule],
  exports: [SessionService, NotificationService],
})
export class CoreModule {}
