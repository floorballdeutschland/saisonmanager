import {
  ChangeDetectorRef,
  Component,
  ComponentRef,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { OverlayService } from '@floorball/core';
import { take, tap } from 'rxjs';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'fb-confirmation',
  templateUrl: './confirmation.component.html',
})
export class ConfirmationComponent {
  @Output()
  handleSubmit: EventEmitter<void> = new EventEmitter<void>();

  @Input()
  title?: string;

  @Input()
  content?: string;

  @Input()
  icon?: string;

  @Input()
  submitButtonTitle?: string;

  @Input()
  buttonVariant?: 'success' | 'error';

  overlayComponentRef?: ComponentRef<ConfirmationDialogComponent>;

  constructor(
    private _overlayService: OverlayService,
    private _cdr: ChangeDetectorRef
  ) {}

  handleOpen() {
    this.overlayComponentRef = this._overlayService.showScrollBlockingOverlay(
      ConfirmationDialogComponent
    );

    this.overlayComponentRef?.instance.onClose$
      .pipe(
        tap(() => {
          this._cdr.markForCheck();
        }),
        take(1)
      )
      .subscribe();

    this.overlayComponentRef?.instance.onSubmit$
      .pipe(
        tap(() => {
          if (this.handleSubmit) {
            this.handleSubmit.emit();
          }
          this.closeDialog();
        }),
        take(1)
      )
      .subscribe();

    this.overlayComponentRef.instance.title = this.title || '';
    this.overlayComponentRef.instance.content = this.content || '';
    this.overlayComponentRef.instance.iconType = this.icon || '';

    if (this.submitButtonTitle) {
      this.overlayComponentRef.instance.submitButtonTitle =
        this.submitButtonTitle;
    }

    if (this.buttonVariant) {
      this.overlayComponentRef.instance.buttonVariant = this.buttonVariant;
    }

    this._cdr.markForCheck();
  }

  closeDialog() {
    this.overlayComponentRef?.instance.onClose$.next(true);
  }
}
