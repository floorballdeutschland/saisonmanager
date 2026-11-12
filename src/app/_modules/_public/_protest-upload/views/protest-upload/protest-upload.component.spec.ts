import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { GameService } from '@floorball/core';
import { ProtestUpload } from '@floorball/types';
import {
  PROTEST_MAX_FILE_SIZE,
  ProtestUploadComponent,
} from './protest-upload.component';

function protest(overrides: Partial<ProtestUpload> = {}): ProtestUpload {
  return {
    status: 'open',
    party_label: 'Gastteam (TV Muster)',
    submitted_at: null,
    filename: null,
    game_number: '42',
    home_team: 'Heim',
    guest_team: 'Gast',
    league: 'Regionalliga',
    date: '2026-11-08',
    start_time: '18:00',
    ...overrides,
  };
}

describe('ProtestUploadComponent', () => {
  let fixture: ComponentFixture<ProtestUploadComponent>;
  let component: ProtestUploadComponent;
  let gameService: jasmine.SpyObj<GameService>;

  function create(token = 'abc') {
    TestBed.configureTestingModule({
      declarations: [ProtestUploadComponent],
      providers: [
        { provide: GameService, useValue: gameService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ token }) } },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(ProtestUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ');
  }

  function pick(file: File) {
    const input = { files: [file] } as unknown as HTMLInputElement;
    component.selectFile({ target: input } as unknown as Event);
    fixture.detectChanges();
  }

  beforeEach(() => {
    gameService = jasmine.createSpyObj('GameService', [
      'getProtest',
      'uploadProtest',
    ]);
  });

  it('zeigt Spiel und Partei eines offenen Links', () => {
    gameService.getProtest.and.returnValue(of(protest()));
    create();

    expect(gameService.getProtest).toHaveBeenCalledWith('abc');
    expect(text()).toContain('Heim gegen Gast');
    expect(text()).toContain('Protestpartei: Gastteam (TV Muster)');
    expect(text()).toContain('genau ein Upload');
  });

  it('meldet einen ungültigen Link', () => {
    gameService.getProtest.and.returnValue(throwError(() => ({ status: 410 })));
    create();

    expect(
      fixture.nativeElement.querySelector('[data-testid="protest-invalid"]')
    ).not.toBeNull();
  });

  it('zeigt die Begründung eines zurückgenommenen Protests', () => {
    gameService.getProtest.and.returnValue(
      throwError(() => ({
        status: 410,
        error: {
          message: 'Dieser Protest wurde im Spielbericht zurückgenommen.',
        },
      }))
    );
    create();

    expect(text()).toContain('zurückgenommen');
  });

  it('nennt einen Verbindungsfehler nicht ungültig und lädt auf Wunsch neu', () => {
    gameService.getProtest.and.returnValues(
      throwError(() => ({ status: 0 })),
      of(protest())
    );
    create();

    expect(
      fixture.nativeElement.querySelector('[data-testid="protest-invalid"]')
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="protest-load-failed"]')
    ).not.toBeNull();

    component.retryLoad();
    fixture.detectChanges();

    expect(text()).toContain('Heim gegen Gast');
  });

  it('zeigt einen bereits genutzten Link als eingegangen', () => {
    gameService.getProtest.and.returnValue(
      of(protest({ status: 'submitted', submitted_at: '2026-11-09T10:00:00Z' }))
    );
    create();

    expect(
      fixture.nativeElement.querySelector('[data-testid="protest-submitted"]')
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="protest-file"]')
    ).toBeNull();
  });

  it('weist ein Foto und eine zu große Datei schon im Browser ab', () => {
    gameService.getProtest.and.returnValue(of(protest()));
    create();

    pick(new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));
    expect(component.selectedFile).toBeNull();
    expect(text()).toContain('als PDF');

    const big = new File(['x'], 'gross.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: PROTEST_MAX_FILE_SIZE + 1 });
    pick(big);
    expect(component.selectedFile).toBeNull();
    expect(text()).toContain('größer als 5 MB');
  });

  it('lädt ein PDF hoch und zeigt danach den Eingang', () => {
    gameService.getProtest.and.returnValue(of(protest()));
    gameService.uploadProtest.and.returnValue(
      of(protest({ status: 'submitted', submitted_at: '2026-11-09T10:00:00Z' }))
    );
    create();
    const pdf = new File(['%PDF-1.4'], 'protest.pdf', {
      type: 'application/pdf',
    });

    pick(pdf);
    component.upload();
    fixture.detectChanges();

    expect(gameService.uploadProtest).toHaveBeenCalledWith('abc', pdf);
    expect(
      fixture.nativeElement.querySelector('[data-testid="protest-submitted"]')
    ).not.toBeNull();
  });

  it('zeigt die Begründung der API, wenn der Upload scheitert', () => {
    gameService.getProtest.and.returnValue(of(protest()));
    gameService.uploadProtest.and.returnValue(
      throwError(() => ({
        status: 422,
        error: {
          message:
            'Über diesen Link wurde bereits ein Protestformular hochgeladen.',
        },
      }))
    );
    create();

    pick(new File(['%PDF'], 'p.pdf', { type: 'application/pdf' }));
    component.upload();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="protest-error"]')
        .textContent
    ).toContain('bereits ein Protestformular');
    expect(component.uploading).toBeFalse();
  });
});
