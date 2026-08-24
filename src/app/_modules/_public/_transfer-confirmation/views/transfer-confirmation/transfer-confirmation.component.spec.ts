import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { TransferConfirmationComponent } from './transfer-confirmation.component';

describe('TransferConfirmationComponent', () => {
  function build(result: string | null) {
    TestBed.configureTestingModule({
      declarations: [TransferConfirmationComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(
                result === null ? {} : { result }
              ),
            },
          },
        },
      ],
    }).overrideTemplate(TransferConfirmationComponent, '');

    const fixture = TestBed.createComponent(TransferConfirmationComponent);
    fixture.componentInstance.ngOnInit();
    return fixture.componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('zeigt die Zustimmung als Erfolg', () => {
    expect(build('approved').view.variant).toBe('success');
  });

  // Der Sammelfall trägt mehr als den kaputten Link: Ein beendeter Antrag hat
  // keinen Token mehr, der alte Link aus der Mail landet also hier. Der Text
  // darf ihn deshalb nicht für ungültig erklären und nicht an einen Verein
  // verweisen, den es nach einer Deaktivierung nicht mehr gibt.
  it('erklärt den nicht mehr verwendbaren Link ohne ihn für ungültig zu erklären', () => {
    const view = build('withdrawn').view;

    expect(view.variant).toBe('error');
    expect(view.title).not.toContain('ungültig,');
    expect(view.message).toContain('beendet');
    expect(view.message).not.toContain('deinen Verein');
  });

  it('fällt ohne result-Parameter auf den Hinweis zurück', () => {
    expect(build(null).view.variant).toBe('error');
  });

  it('fällt bei unbekanntem result auf den Hinweis zurück', () => {
    expect(build('unbekannt').view.variant).toBe('error');
  });
});
