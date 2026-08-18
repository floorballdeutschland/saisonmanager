export interface Arena {
  id: number;
  // `arenas.name` und `arenas.city` sind in der Datenbank nicht NOT NULL. Die
  // Validierung im Modell greift erst seit der Spielort-Verwaltung, der
  // Altbestand aus dem Import 2010–2014 enthält Einträge ohne Namen bzw. ohne
  // Stadt. Der Typ sagt das jetzt auch, damit Zugriffe abgesichert werden
  // müssen statt zur Laufzeit zu scheitern.
  name: string | null;
  city: string | null;
  street?: string;
  housenumber?: string;
  postcode?: string;
  schedule_item?: string;
  // Steuert, ob der Spielort im Spieltag zur Auswahl steht (API: Arena.active).
  // Optional, weil `Partial<Arena>`-Payloads das Feld beim Anlegen nicht setzen
  // und der Altbestand vor #451 nie darauf angesehen wurde.
  active?: boolean;
}
