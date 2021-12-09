import { Injectable } from '@angular/core';
import { ComponentPortal, ComponentType } from '@angular/cdk/portal';
import { Overlay } from '@angular/cdk/overlay';
import { Subject, take, tap } from 'rxjs';

interface CloseableComponent {
  onClose$: Subject<boolean>;
}

@Injectable({
  providedIn: 'root',
})
export class OverlayService {
  private _overlayRefs: {
    parentActiveElement: HTMLButtonElement | null;
    id: number;
  }[] = [];
  private readonly _bodyOverlayClass = 'has-overlay';

  constructor(private _overlay: Overlay) {}

  showScrollBlockingOverlay<T extends CloseableComponent>(
    component: ComponentType<T>
  ) {
    const id = Math.random();
    const scrollPosition = window.pageYOffset;

    if (!this._overlayRefs.length) {
      document.body.style.top = -scrollPosition + 'px';
      document.body.classList.add(this._bodyOverlayClass);
    }

    const overlayRef = this._overlay.create();
    const userProfilePortal = new ComponentPortal(component);
    const componentRef = overlayRef.attach(userProfilePortal);

    this._overlayRefs.push({
      id,
      parentActiveElement: document.activeElement as HTMLButtonElement | null,
    });

    componentRef.instance.onClose$
      .pipe(
        tap(() => {
          componentRef.destroy();
          overlayRef.dispose();

          const ref = this._overlayRefs.find((r) => r.id === id);
          this._overlayRefs = this._overlayRefs.filter((r) => r.id !== id);

          if (!this._overlayRefs.length) {
            document.body.classList.remove(this._bodyOverlayClass);
            document.body.style.top = '';
            window.scrollTo(0, scrollPosition);
          }

          ref?.parentActiveElement?.focus();
        }),
        take(1)
      )
      .subscribe();

    return componentRef;
  }
}
