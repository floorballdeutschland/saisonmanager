import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { PublicNotFoundRoutingModule } from './public-not-found-routing.module';
import * as Views from './views';

// Die Texte stehen im globalen Scope (`notFound.*`): Die Seite soll auch dann
// sofort beschriftet sein, wenn der Aufruf direkt auf ihr landet, und ein
// eigener Scope käme erst mit einem weiteren Request.
@NgModule({
  declarations: [Views.NotFoundComponent],
  imports: [
    CommonModule,
    RouterModule,
    TranslocoModule,
    PublicNotFoundRoutingModule,
  ],
})
export class PublicNotFoundModule {}
