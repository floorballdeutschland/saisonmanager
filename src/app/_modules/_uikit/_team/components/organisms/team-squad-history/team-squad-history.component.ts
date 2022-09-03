import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  selector: 'fb-team-squad-history',
  templateUrl: './team-squad-history.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class TeamSquadHistoryComponent {
  @Input() onClose!: () => void;
  @Input() team!: string;
}
