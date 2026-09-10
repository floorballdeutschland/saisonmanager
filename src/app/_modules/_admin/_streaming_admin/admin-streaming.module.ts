import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLOCO_SCOPE } from '@jsverse/transloco';
import { UikitCommonModule } from '@floorball/uikit/common';
import { AdminStreamingRoutingModule } from './admin-streaming-routing.module';

import * as Views from './views';

/**
 * Der Streaming-Bereich des Bundesverbands.
 *
 * Er ersetzt die Excel-Blätter „Übersicht" und „Erstellung und Kontrolle", aus
 * denen die YouTube-Livestreams bisher über eine Zwischen-CSV angelegt wurden.
 */
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminStreamingRoutingModule,
    UikitCommonModule,
  ],
  declarations: [Views.StreamingIndexComponent],
  providers: [
    {
      provide: TRANSLOCO_SCOPE,
      useValue: { scope: 'admin/streaming', alias: 'streamingAdmin' },
      multi: true,
    },
  ],
})
export class AdminStreamingModule {}
