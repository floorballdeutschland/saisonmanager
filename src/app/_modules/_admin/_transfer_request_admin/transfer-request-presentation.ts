import { TranslocoService } from '@jsverse/transloco';
import { TransferRequest } from '@floorball/types';
import { downloadCsv } from 'src/app/_helpers/_utils/csv-export';

// Beschriftungen und CSV-Ausgabe der Transfervorgaenge, geteilt zwischen der
// Hauptliste und der Liste der eingehenden Vorgaenge. Beide zeigen dieselben
// Datensaetze, nur unter verschiedenen Fragestellungen -- eine zweite Kopie der
// Status-Zuordnung wuerde bei jedem neuen Status auseinanderlaufen.

const STATUS_KEYS: { [key: string]: string } = {
  pending_club: 'statusPendingClub',
  pending_player: 'statusPendingPlayer',
  pending_lv: 'statusPendingLv',
  scheduled: 'statusScheduled',
  approved: 'statusApproved',
  rejected_by_club: 'statusRejectedByClub',
  rejected_by_player: 'statusRejectedByPlayer',
  rejected_by_lv: 'statusRejectedByLv',
  revoked: 'statusRevoked',
  withdrawn: 'statusWithdrawn',
  expired: 'statusExpired',
};

export function transferStatusLabel(
  transloco: TranslocoService,
  status: string
): string {
  return STATUS_KEYS[status]
    ? transloco.translate(`transferRequestAdmin.list.${STATUS_KEYS[status]}`)
    : status;
}

export function transferStatusClass(status: string): string {
  if (status === 'approved') return 'text-green-600 font-medium';
  if (status === 'scheduled') return 'text-yellow-600 font-medium';
  if (
    status.startsWith('rejected') ||
    status === 'revoked' ||
    status === 'withdrawn' ||
    status === 'expired'
  )
    return 'text-red-500';
  return 'text-primary font-medium';
}

export function transferTypeLabel(
  transloco: TranslocoService,
  request: TransferRequest
): string {
  return transloco.translate(
    request.request_type === 'release'
      ? 'transferRequestAdmin.list.typeRelease'
      : 'transferRequestAdmin.list.typeTransfer'
  );
}

export function transferTypeClass(request: TransferRequest): string {
  return request.request_type === 'release'
    ? 'text-xs font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800'
    : 'text-xs font-semibold px-1.5 py-0.5 rounded bg-fb-gray-200 text-fb-gray-500';
}

export function formatTransferDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

// Dieselben Spalten fuer beide Listen: Wer die Ausfuhr weiterverarbeitet
// (Rechnungslauf, Meldung an den Landesverband), soll nicht zwei Formate kennen
// muessen. Welche Zeilen ausgegeben werden, entscheidet der Aufrufer.
export function exportTransferCsv(
  transloco: TranslocoService,
  basename: string,
  requests: TransferRequest[]
): void {
  const headers = [
    transloco.translate('transferRequestAdmin.list.csvLastName'),
    transloco.translate('transferRequestAdmin.list.csvFirstName'),
    transloco.translate('transferRequestAdmin.list.csvBirthdate'),
    transloco.translate('transferRequestAdmin.list.csvType'),
    transloco.translate('transferRequestAdmin.list.csvDirect'),
    transloco.translate('transferRequestAdmin.list.csvFormerClub'),
    transloco.translate('transferRequestAdmin.list.csvRequestingClub'),
    transloco.translate('transferRequestAdmin.list.csvApprovedAt'),
  ];
  const rows = requests.map((r) => [
    r.player.last_name,
    r.player.first_name,
    r.player.birthdate ? formatTransferDate(r.player.birthdate) : '',
    transferTypeLabel(transloco, r),
    r.direct
      ? transloco.translate('transferRequestAdmin.list.csvYes')
      : transloco.translate('transferRequestAdmin.list.csvNo'),
    r.former_club.name,
    r.requesting_club.name,
    r.lv_approved_at ? formatTransferDate(r.lv_approved_at) : '',
  ]);

  downloadCsv(basename, headers, rows);
}
