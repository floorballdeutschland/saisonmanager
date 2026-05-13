import { GameNoticeHeadlinePipe } from './game-notice-headline.pipe';

describe('GameNoticeHeadlinePipe', () => {
  let pipe: GameNoticeHeadlinePipe;

  beforeEach(() => {
    pipe = new GameNoticeHeadlinePipe();
  });

  it('Postponed → "Spiel verschoben"', () => {
    expect(pipe.transform('Postponed')).toBe('Spiel verschoben');
  });

  it('Canceled → "Spiel abgesagt"', () => {
    expect(pipe.transform('Canceled')).toBe('Spiel abgesagt');
  });

  it('NoDateAndTime → "Noch nicht terminiert"', () => {
    expect(pipe.transform('NoDateAndTime')).toBe('Noch nicht terminiert');
  });

  it('unbekannter Typ → "Sonstiges"', () => {
    expect(pipe.transform('Other')).toBe('Sonstiges');
    expect(pipe.transform('')).toBe('Sonstiges');
  });
});
