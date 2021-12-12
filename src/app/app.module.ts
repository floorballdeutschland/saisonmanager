import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import {
  GameService,
  LeagueService,
  MetaService,
  UserService,
} from './_services';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, AppRoutingModule, HttpClientModule],
  providers: [MetaService, LeagueService, GameService, UserService],
  bootstrap: [AppComponent],
})
export class AppModule {}
