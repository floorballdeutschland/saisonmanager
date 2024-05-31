import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GlassesIconComponent } from './components/glasses-icon/glasses-icon.component';

@NgModule({
  declarations: [GlassesIconComponent],
  exports: [GlassesIconComponent],
  imports: [CommonModule],
})
export class IconsModule {}
