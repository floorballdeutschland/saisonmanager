import { GameNoticeVisibilityPipe } from './game-notice-visibility.pipe';

describe('GameNoticeVisibilityPipe', () => {
  let pipe: GameNoticeVisibilityPipe;

  beforeEach(() => {
    pipe = new GameNoticeVisibilityPipe();
  });

  describe('Postponed', () => {
    it('zeigt arena', () => {
      expect(pipe.transform('Postponed', 'arena')).toBeTrue();
    });

    it('versteckt time', () => {
      expect(pipe.transform('Postponed', 'time')).toBeFalse();
    });

    it('versteckt date', () => {
      expect(pipe.transform('Postponed', 'date')).toBeFalse();
    });
  });

  describe('Canceled', () => {
    it('versteckt arena', () => {
      expect(pipe.transform('Canceled', 'arena')).toBeFalse();
    });

    it('versteckt time', () => {
      expect(pipe.transform('Canceled', 'time')).toBeFalse();
    });

    it('versteckt date', () => {
      expect(pipe.transform('Canceled', 'date')).toBeFalse();
    });
  });

  describe('NoDateAndTime', () => {
    it('zeigt arena', () => {
      expect(pipe.transform('NoDateAndTime', 'arena')).toBeTrue();
    });

    it('versteckt time', () => {
      expect(pipe.transform('NoDateAndTime', 'time')).toBeFalse();
    });
  });

  describe('Normalfall', () => {
    it('zeigt alle Felder bei undefined', () => {
      expect(pipe.transform(undefined, 'arena')).toBeTrue();
      expect(pipe.transform(undefined, 'time')).toBeTrue();
      expect(pipe.transform(undefined, 'date')).toBeTrue();
    });

    it('zeigt alle Felder bei unbekanntem Typ', () => {
      expect(pipe.transform('Other', 'arena')).toBeTrue();
      expect(pipe.transform('Other', 'time')).toBeTrue();
    });
  });
});
