import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UikitCommonModule } from '@floorball/uikit/common';
import { PublicProtestUploadRoutingModule } from './public-protest-upload-routing.module';
import * as Views from './views';

/**
 * Upload des Protestformulars über den Einmal-Link aus der Mail an eine
 * Protestpartei, ohne Anmeldung.
 */
@NgModule({
  declarations: [Views.ProtestUploadComponent],
  imports: [CommonModule, UikitCommonModule, PublicProtestUploadRoutingModule],
})
export class PublicProtestUploadModule {}
