import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { Game, GameAdditionalFields, GameStatusOption } from '@floorball/types';
import { LeagueService } from '@floorball/core';

export const STB_ITEMS_SCHIEDSRICHTER = [
  'Einladung der Schiedsrichter und des Gastteams fristgerecht erfolgt',
  'Sporthalle und Garderoben 90 Minuten vor Spielbeginn geöffnet',
  'Meeting 60 Minuten vor Spielbeginn durchgeführt',
  'Ausreichend Getränke für Schiedsrichter vorhanden',
  'Kostenerstattung für Schiedsrichter vor dem Einsatz erfolgt',
  'Spielberichtsformular 30 Minuten vor Spielbeginn ausgefüllt',
  'Bälle für Warm-up (mind. 2 pro Feldspieler) bereitgestellt',
  'Laut Regelwerk empfohlener Sturzraum von mind. 0,5 Meter vorhanden',
  'Spielsekretariat mit mind. einem Schriftführer, einem Zeitnehmer und Ausrüstung ordnungsgemäß ausgestattet',
  'Bandendienst (mind. 4 Personen) vorhanden und aktiv',
];

export const STB_ITEMS_AUSRICHTER = [
  'Schiedsrichter 75 Minuten vor Spielbeginn eingetroffen',
  'Der Ausrichter kann Videomaterial vom Spiel zur Verfügung stellen',
];

@Component({
  selector: 'fb-match-report-step-three',
  templateUrl: './match-report-step-three.component.html',
  standalone: false,
})
export class MatchReportStepThreeComponent {
  @Input()
  game!: Game;

  @Input()
  additionalFields!: GameAdditionalFields;

  @Input()
  nextStatusOption!: GameStatusOption;

  @Output()
  handleReload = new EventEmitter<void>();

  @Output()
  handleSbbScroll = new EventEmitter<void>();

  @Output()
  updatePeriod: EventEmitter<string> = new EventEmitter<string>();

  @Output()
  closeMatchRecord: EventEmitter<void> = new EventEmitter<void>();

  readonly stbSchiedsrichter = STB_ITEMS_SCHIEDSRICHTER;
  readonly stbAusrichter = STB_ITEMS_AUSRICHTER;

  stbAnswers: Record<string, boolean | null> = {};
  stbComment = '';

  get isFvd(): boolean {
    return this.game?.game_operation_slug === 'fvd';
  }

  get stbComplete(): boolean {
    if (!this.isFvd) return true;
    const allItems = [
      ...this.stbSchiedsrichter.map((_, i) => 'sr_' + i),
      ...this.stbAusrichter.map((_, i) => 'aus_' + i),
    ];
    return allItems.every(
      (key) => this.stbAnswers[key] === true || this.stbAnswers[key] === false
    );
  }

  setStbAnswer(prefix: string, index: number, value: boolean) {
    this.stbAnswers[prefix + '_' + index] = value;
  }

  constructor(
    private _leagueService: LeagueService,
    private _cdr: ChangeDetectorRef
  ) {}

  scrollToSbbNavigation() {
    this.handleSbbScroll.emit();
  }

  reloadGame() {
    this.handleReload.emit();
  }

  handleFinalize() {
    this.closeMatchRecord.emit();
  }
}
