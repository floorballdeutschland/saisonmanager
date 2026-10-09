import { RefereeCourseField } from '@floorball/types';
import { cleanAnswers, emptyAnswers, missingRequired } from './signup-answers';

const field = (
  id: number,
  field_type: RefereeCourseField['field_type'],
  required = true
): RefereeCourseField => ({
  id,
  label: `F${id}`,
  field_type,
  options: ['a', 'b'],
  required,
  visible_to_lead: true,
  include_in_billing_export: false,
});

describe('signup-answers', () => {
  const fields = [
    field(1, 'text'),
    field(2, 'checkbox'),
    field(3, 'number', false),
  ];

  it('meldet fehlende Pflichtfelder, auch die nicht angehakte Checkbox', () => {
    const answers = emptyAnswers(fields);
    expect(missingRequired(fields, answers)).toEqual(['F1', 'F2']);
    answers.custom_answers['1'] = '  x ';
    answers.custom_answers['2'] = true;
    expect(missingRequired(fields, answers)).toEqual([]);
  });

  it('bereinigt fuer die API', () => {
    const answers = emptyAnswers(fields);
    answers.custom_answers['1'] = ' Text ';
    answers.custom_answers['3'] = '2,5';
    answers.remarks = '  ';
    expect(cleanAnswers(fields, answers)).toEqual({
      desired_license_level_id: null,
      remarks: '',
      custom_answers: { '1': 'Text', '2': false, '3': 2.5 },
    });
  });
});
