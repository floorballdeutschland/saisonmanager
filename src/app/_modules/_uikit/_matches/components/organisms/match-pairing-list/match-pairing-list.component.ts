import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'fb-match-pairing-list',
  templateUrl: './match-pairing-list.component.html',
})
export class MatchPairingListComponent {
  @Input()
  matches!: unknown[];
}
