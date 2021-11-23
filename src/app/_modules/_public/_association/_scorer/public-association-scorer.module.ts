import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicAssociationScorerRoutingModule } from './public-association-scorer-routing.module';
import { ScorerComponent } from './_views/scorer/scorer.component';

@NgModule({
  declarations: [ScorerComponent],
  imports: [CommonModule, PublicAssociationScorerRoutingModule],
})
export class PublicAssociationScorerModule {}
