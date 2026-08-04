/**
 * Rollen-ID zu dem Berechtigungs-Flag, das das Vergeben dieser Rolle erlaubt.
 *
 * Die Flags liefert die API in `User#permissions_items` aus
 * `User::ASSIGNABLE_ROLE_IDS`; dieselbe Tabelle prüft der Server beim
 * Speichern. Hier steht deshalb bewusst keine eigene Rollenlogik, nur die
 * Zuordnung, und die liegt an einer Stelle für Anlage und Bearbeitung.
 */
export const ROLE_PERMISSION_FLAG: Record<number, string> = {
  1: 'assign_role_admin',
  2: 'assign_role_sbk',
  3: 'assign_role_rsk',
  4: 'assign_role_vm',
  5: 'assign_role_tm',
  7: 'assign_role_ansetzer',
};

/**
 * True, wenn die Berechtigungen die assign_role_*-Flags überhaupt enthalten.
 * Sitzungen, die vor deren Einführung angemeldet wurden, tragen sie nicht im
 * localStorage; die Aufrufer bleiben dann beim bisherigen Verhalten, statt eine
 * leere Rollenauswahl anzuzeigen.
 */
export function hasAssignRoleFlags(permissions: {
  [key: string]: boolean;
}): boolean {
  return Object.values(ROLE_PERMISSION_FLAG).some(
    (flag) => flag in permissions
  );
}
