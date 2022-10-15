import {
  Component,
  ElementRef,
  EventEmitter,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { Subject } from 'rxjs';
import {
  AssociationService,
  FavoriteService,
  LeagueService,
} from '@floorball/core';

@Component({
  selector: 'fb-confirmation-dialog',
  templateUrl: './confirmation-dialog.component.html',
})
export class ConfirmationDialogComponent {
  @Output()
  closeDialog: EventEmitter<boolean> = new EventEmitter<boolean>();

  @ViewChild('closeButton')
  closeButton!: ElementRef<HTMLButtonElement>;

  onClose$ = new Subject<boolean>();
  onSubmit$ = new Subject<boolean>();

  public title = '';
  public content = '';
  public submitButtonTitle = 'Fortfahren';
  public buttonVariant: 'success' | 'error' = 'error';

  close() {
    this.onClose$.next(true);
  }

  submit() {
    this.onSubmit$.next(true);
  }
}
