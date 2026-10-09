import { OwnCourseRegistration, RefereeCourseOffer } from '@floorball/types';

/** Testdaten für die Specs der Kursanmeldung. */
export function offer(
  id: number,
  extra: Partial<RefereeCourseOffer> = {}
): RefereeCourseOffer {
  return {
    id,
    title: `Kurs ${id}`,
    course_type: 'g',
    format: 'in_person',
    status: 'published',
    registration_mode: 'open',
    state_association: { id: 3, name: 'Hessen' },
    partner_state_association_ids: [],
    hosting_club: null,
    starts_on: '2026-11-21',
    ends_on: '2026-11-21',
    sessions: [{ starts_at: '2026-11-21T09:00:00+01:00', location: 'Halle' }],
    online_platform: null,
    min_participants: null,
    max_participants: 20,
    free_seats: 5,
    registration_opens_at: null,
    registration_deadline: null,
    cancellation_deadline: null,
    registration_closed_reason: null,
    min_age: null,
    fee_member_cents: 2500,
    fee_non_member_cents: null,
    fee_only_on_license: false,
    fee_note: null,
    prerequisites_note: null,
    contact_email: null,
    description: null,
    license_levels: [{ id: 2, name: 'L3' }],
    fields: [
      {
        id: 11,
        label: 'T-Shirt',
        field_type: 'select',
        options: ['S', 'M'],
        required: true,
        visible_to_lead: true,
        include_in_billing_export: false,
      },
    ],
    ...extra,
  };
}

export function ownRegistration(
  id: number,
  extra: Partial<OwnCourseRegistration> = {}
): OwnCourseRegistration {
  return {
    id,
    referee_course_id: 1,
    course_title: 'Kurs 1',
    starts_on: '2026-11-21',
    vorname: 'Ada',
    nachname: 'Muster',
    geburtsdatum: '2000-01-01',
    club: null,
    referee_id: null,
    status: 'registered',
    cancelled_at: null,
    late_cancellation: false,
    result: null,
    desired_license_level_id: null,
    remarks: null,
    custom_answers: {},
    fee_cents: 2500,
    source: 'portal',
    cancellable: true,
    ...extra,
  };
}
