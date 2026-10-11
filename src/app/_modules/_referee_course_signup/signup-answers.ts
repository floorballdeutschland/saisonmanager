import { CourseSignupAnswers, RefereeCourseField } from '@floorball/types';

/** Leere Antworten für ein Angebot. Checkboxen starten als „nein“. */
export function emptyAnswers(
  fields: RefereeCourseField[]
): CourseSignupAnswers {
  const custom: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.field_type === 'checkbox') custom[String(field.id)] = false;
    if (field.field_type === 'multi_select') custom[String(field.id)] = [];
  }
  return {
    desired_license_level_id: null,
    remarks: '',
    custom_answers: custom,
  };
}

/**
 * Bezeichnungen der Pflichtfelder ohne Antwort. Eine Pflicht-Checkbox muss
 * angehakt sein, wie in der API (RefereeCourseRegistration).
 */
export function missingRequired(
  fields: RefereeCourseField[],
  answers: CourseSignupAnswers
): string[] {
  return fields
    .filter((f) => f.required && !f.archived)
    .filter((f) => {
      const value = answers.custom_answers[String(f.id)];
      if (f.field_type === 'checkbox') return value !== true;
      if (Array.isArray(value)) return value.length === 0;
      return (
        value === undefined || value === null || String(value).trim() === ''
      );
    })
    .map((f) => f.label);
}

/** Antworten für die API: leere Texte weglassen, Zahlen als Zahl. */
export function cleanAnswers(
  fields: RefereeCourseField[],
  answers: CourseSignupAnswers
): CourseSignupAnswers {
  const custom: Record<string, unknown> = {};
  for (const field of fields) {
    const key = String(field.id);
    let value = answers.custom_answers[key];
    if (typeof value === 'string') value = value.trim();
    if (value === '' || value === undefined || value === null) continue;
    if (field.field_type === 'number' && typeof value === 'string')
      value = Number(value.replace(',', '.'));
    custom[key] = value;
  }
  return {
    desired_license_level_id: answers.desired_license_level_id,
    remarks: answers.remarks.trim(),
    custom_answers: custom,
  };
}
