import { GameAdditionalFields } from '@floorball/types';
import {
  SPECIAL_EVENT_DESCRIPTION_MIN_LENGTH,
  specialEventDescriptionLength,
  specialEventDescriptionMissing,
} from './special-event-description';

function fields(
  special_event: boolean,
  special_event_string: string | null
): GameAdditionalFields {
  return {
    special_event,
    special_event_string,
  } as unknown as GameAdditionalFields;
}

describe('special-event-description', () => {
  it('verlangt 50 Zeichen wie die API', () => {
    expect(SPECIAL_EVENT_DESCRIPTION_MIN_LENGTH).toBe(50);
  });

  it('zählt Leerraum am Rand nicht mit', () => {
    expect(specialEventDescriptionLength('  abc \n')).toBe(3);
    expect(specialEventDescriptionLength(null)).toBe(0);
  });

  it('fehlt nur, wenn das besondere Ereignis angehakt ist', () => {
    expect(specialEventDescriptionMissing(fields(false, ''))).toBeFalse();
    expect(specialEventDescriptionMissing(fields(true, ''))).toBeTrue();
    expect(specialEventDescriptionMissing(fields(true, null))).toBeTrue();
    expect(specialEventDescriptionMissing(undefined)).toBeFalse();
  });

  it('49 Zeichen reichen nicht, 50 schon', () => {
    expect(
      specialEventDescriptionMissing(fields(true, ` ${'x'.repeat(49)} `))
    ).toBeTrue();
    expect(
      specialEventDescriptionMissing(fields(true, 'x'.repeat(50)))
    ).toBeFalse();
  });
});
