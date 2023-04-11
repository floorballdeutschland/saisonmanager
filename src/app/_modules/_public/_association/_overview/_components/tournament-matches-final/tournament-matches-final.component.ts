import { Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

@Component({
  selector: 'fb-tournament-matches-final',
  templateUrl: './tournament-matches-final.component.html',
})
export class TournamentMatchesFinalComponent {
  @Input()
  matches$?: Observable<any>;
}
