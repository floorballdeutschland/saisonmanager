# Fragebogen: Saisonmanager – Perspektive kantonaler/regionaler Spielbetrieb

**An:** Swiss Unihockey – Zuständige Spielbetrieb / Geschäftsstelle  
**Von:** Floorball Deutschland e. V. – Saisonmanager-Entwicklung  
**Datum:** Mai 2026

---

## Hintergrund

Der Saisonmanager (SM) ist die zentrale Software, über die Floorball Deutschland den Spielbetrieb organisiert: Lizenzen, Spielpläne, Spielberichte, Transfers und Benutzerverwaltung. Das System wird heute von der FD-Geschäftsstelle, den FD-Spielbetriebskommissionen (SBK) und den Spielbetriebskommissionen der Landesverbände (LV) genutzt, außerdem von Vereins- und Teammanagern.

Wir planen mehrere größere Erweiterungen und stehen dabei vor der Frage, wie wir den nationalen Spielbetrieb (Bundesliga, Pokal) und die Landesverbands-Spielbetriebe (eigene Ligen, eigene Spielordnung) gleichzeitig gut abbilden können, ohne einen der beiden zu bevorzugen oder unnötig einzuschränken.

Da Swiss Unihockey eine vergleichbare Struktur hat — nationaler Verband mit eigenen Ligen und Kantonalverbänden mit eigenem Spielbetrieb — würden wir sehr gerne von euren Erfahrungen lernen: Was funktioniert bei euch gut, was hat in der Praxis nicht so geklappt, und wie habt ihr bestimmte Fragen gelöst?

Die folgenden Themenbereiche beschreiben jeweils kurz den aktuellen Stand und unsere Überlegungen, gefolgt von konkreten Fragen an euch.

---

## 1. Transferprozess

**Situation heute bei FD:**  
Wenn ein Spieler den Verein wechselt, muss die bestehende Lizenz auf den Status „Transfer" gesetzt werden. Erst dann kann der neue Verein eine neue Lizenz beantragen. Diesen Schritt kann heute ausschließlich die FD-Geschäftsstelle ausführen — auch wenn der Spieler nur im LV-Spielbetrieb aktiv ist und der Transfer innerhalb eines Landesverbands stattfindet.

**Was wir planen:**  
Den gesamten Transferprozess im SM abbilden: Spieler stellt Antrag, nehmender Verein bestätigt, gebender Verein gibt frei (oder lehnt ab), SBK führt durch. Außerdem soll ein Transfer auf Wunsch terminiert werden können, d. h. der Spieler bleibt bis zu einem festgelegten Datum beim alten Verein spielberechtigt.

**Unsere Sorge:**  
Wenn wir den Workflow zu starr auf eine bestimmte Abfolge festlegen, passt das möglicherweise nicht zu allen Spielordnungen. Wir wissen auch nicht, ob das Konzept eines „Wunschdatums" für Transfers bei euch bekannt oder in der Spielordnung verankert ist.

**Fragen an euch:**

1. Wie läuft ein Transfer bei Swiss Unihockey ab? Gibt es einen einheitlichen Prozess, der für alle Kantone gleich gilt, oder haben einzelne Kantone abweichende Regelungen?
2. Wer hat bei euch die Befugnis, eine laufende Lizenz für einen Transfer zu sperren — nur die nationale Geschäftsstelle, oder auch Kantonalverbände im Rahmen ihres Spielbetriebs?
3. Gibt es bei euch die Möglichkeit, einen Transfer vorab zu terminieren (Wirksamkeit ab Datum X)? Ist das in eurer Spielordnung geregelt?
4. Gab es bei euch Fälle, in denen ein Kantonalverband einen Transfer innerhalb seines Spielbetriebs selbst abwickeln wollte, aber nicht konnte — und wie habt ihr das gelöst?

---

## 2. Benutzerverwaltung und Zugriffsrechte

**Situation heute bei FD:**  
Benutzerkonten werden ausschließlich durch die FD-Geschäftsstelle angelegt und verwaltet. Änderungen an Rolle, E-Mail oder Vereinszugehörigkeit laufen ebenfalls zentral. Das führt zu Engpässen: Besonders häufig kritisiert ist, dass LV-SBKen keine eigenen Konten anlegen können, obwohl sie die tägliche Verwaltung ihres Spielbetriebs selbst übernehmen.

**Was wir planen:**  
LV-SBKen sollen Konten für Vereins- und Teammanager innerhalb ihres Verbands selbst anlegen und verwalten können. FD-SBK soll Konten für alle Ebenen anlegen können. Direkte Passwortänderungen soll niemand vornehmen dürfen — stattdessen wird eine „Passwort vergessen"-Mail ausgelöst.

**Unsere Sorge:**  
Wenn LV-SBKen eigenständig Konten anlegen, besteht das Risiko, dass versehentlich Konten mit zu weitreichendem Zugriff entstehen. Außerdem ist unklar, wie wir verhindern, dass ein LV-Konto Zugriff auf Daten eines anderen LV erhält.

**Fragen an euch:** 5. Wer legt bei Swiss Unihockey Benutzerkonten an — nur die nationale Geschäftsstelle, oder auch die Kantonalverbände? 6. Gibt es Konten, die gleichzeitig Zugriff auf kantonalen und nationalen Spielbetrieb haben? Wie ist das berechtigt? 7. Habt ihr Erfahrungen mit Benutzerkonten, die zu viel oder zu wenig Zugriff hatten — und wie habt ihr das geregelt?

---

## 3. Lizenzsystem – Besondere Lizenztypen

**Situation heute bei FD:**  
Das Lizenzsystem unterscheidet zwischen Erst- und Folgelizenzen, aber nicht systematisch zwischen „Erstlizenz" (erstes Mal lizenziert, muss Unterlagen einreichen) und „Zweitlizenz" (zweites Engagement, Verfahren vereinfacht). Expresslizenzen — Lizenzen, die nach der regulären Wochenfrist noch für das kommende Wochenende erteilt werden können — existieren in der Spielordnung, sind im SM aber nicht explizit abgebildet. Außerdem müssen Dokumente (z. B. Anti-Doping-Unterstellungserklärung) heute per E-Mail eingereicht werden, obwohl die SBK die Freigabe im SM vornimmt.

**Was wir planen:**

- Unterscheidung Erst-/Zweitlizenz für SBKen sichtbar machen
- Expresslizenz als eigene Antragsoption mit Benachrichtigung
- Dokument-Upload direkt im Lizenzantrag

**Unsere Sorge:**  
Diese drei Konzepte sind in der FD-Spielordnung verankert — aber nicht unbedingt in allen LV-Spielordnungen. Wenn wir diese Features so bauen, dass sie für jeden Lizenzantrag sichtbar sind, könnten LV-SBKen damit konfrontiert werden, dass sie Felder ausfüllen oder Optionen angeboten bekommen, die für ihren Spielbetrieb gar nicht gelten.

**Fragen an euch:** 8. Unterscheidet ihr bei Swiss Unihockey zwischen Erst- und Zweitlizenz — also ob jemand zum ersten Mal lizenziert wird oder bereits früher eine Lizenz hatte? 9. Gibt es bei euch eine Expresslizenz-Regelung? Gilt sie national und kantonal, oder nur auf einer Ebene? 10. Welche Dokumente muss ein Spieler bei der Lizenzbeantragung einreichen — und ist das im nationalen und kantonalen Spielbetrieb gleich? 11. Haben Kantonalverbände bei euch eine eigene Lizenzkategorie, oder sind alle Spieler — auch rein kantonal aktive — national lizenziert?

---

## 4. Ligabenennung und -klassifizierung

**Situation heute bei FD:**  
Liganamen werden aktuell als Freitext eingetragen. Das führt zu Inkonsistenzen: „KF" vs. „Kleinfeld", „Herren" mal vorne, mal hinten, manche Ligen gar nicht nach Geschlecht benannt. Das erschwert automatische Auswertungen, z. B. wenn man alle Damen-Kleinfeld-Ligen filtern will.

Außerdem fehlen Ligaklassen für besondere Formate: Wenn ein unterklassiges Team in einer Relegationsrunde spielt, hat es danach dieselbe Lizenzklasse wie ein reguläres Erstliga-Team — das verfälscht die Lizenzabrechnung.

**Was wir planen:**  
Option A: Nur Namenskonventionen dokumentieren (freiwillig).  
Option B: Pflichtfelder für Spielfeld (Kleinfeld/Großfeld), Geschlecht und Ligastufe — der Anzeigename bleibt trotzdem ein Freitextfeld (für Sponsornamen etc.).  
Zusätzlich neue Ligaklassen „Relegation" und „Endrunde" für Sonderformate.

**Unsere Sorge:**  
Pflichtfelder wirken sich auf alle LVs aus, nicht nur auf den nationalen Spielbetrieb. LV-Ligen ohne klare Geschlechtertrennung (z. B. Mixed-Formate in Jugendligen) oder ohne Spielfeldtyp (z. B. Hallenturniere) würden gezwungen, ein Feld zu befüllen, das nicht passt. Gleichzeitig bringt Freitext wenig Mehrwert bei Auswertungen.

**Fragen an euch:** 12. Wie benennt ihr Ligen im kantonalen Spielbetrieb? Gibt es eine Konvention oder ist das jedem Kanton überlassen? 13. Habt ihr Ligaformate, die sich schwer in Kategorien wie Geschlecht oder Spielfeldgröße einordnen lassen — z. B. Mixed-Ligen oder Sonderformate? 14. Gibt es bei euch spezielle Ligaklassen für Sonderformate wie Relegation oder Endrunden? Hat das Auswirkungen auf die Lizenzabrechnung?

---

## 5. Saisonformate: Meister-/Platzierungsrunde und Hinrunde/Rückrunde

**Situation heute bei FD:**  
Spielpläne bestehen aus Spieltagen innerhalb einer Liga. Es gibt keine eingebaute Unterstützung dafür, eine Saison in Vor- und Rücklauf aufzuteilen, bei der Punkte oder Lizenzen aus der Vorrunde in die Rückrunde übernommen werden. Das bedeutet: Wenn ein LV seine Saison in eine Vorrunden-Staffel und eine Meisterrunde aufteilt, müssen Punkte manuell nachgetragen und Lizenzen neu beantragt werden.

**Was wir planen:**  
Eine Möglichkeit, beim Anlegen einer Folgestaffel (Meisterrunde, Platzierungsrunde, Rückrunde) Punkte aus einer Vorrundenstaffel zu übernehmen und bestehende Lizenzen automatisch anzuerkennen.

**Unsere Sorge:**  
Dieses Feature kommt aus dem LV-Spielbetrieb (Bayern). Auf Bundesebene ist das Format aktuell nicht im Einsatz. Wenn wir die Datenstruktur zu sehr auf diesen Anwendungsfall ausrichten, könnte das die Flexibilität für andere Formate einschränken — oder der nationale Spielbetrieb müsste mit einer Funktion leben, die für ihn nicht gedacht ist.

**Fragen an euch:** 15. Kennt ihr das Format Meister-/Platzierungsrunde in eurem Spielbetrieb — national oder kantonal? 16. Wenn ja: Werden Punkte aus der Vorrunde in die Folgestaffel übernommen? Und wie handhabt ihr die Spielberechtigung — müssen Spieler eine neue Lizenz beantragen oder gilt die Vorrunden-Lizenz weiter? 17. Habt ihr Erfahrungen damit, wie komplex es ist, solche Staffelübergänge technisch abzubilden?

---

## 6. Teamfreigaben für mehrere Wettbewerbe

**Situation heute bei FD:**  
Wenn ein Team neben der Liga auch im Pokal spielt, muss der Zugang zum Pokal-Spielbetrieb aktuell manuell auf Datenbankebene freigeschaltet werden. Das ist ein bekanntes Problem und betrifft auch LVs, die Playoffs als eigenständige Ligen anlegen.

**Was wir planen:**  
Eine Möglichkeit für SBKen, Teams manuell für zusätzliche Ligen oder Wettbewerbe freizuschalten — ohne Eingriff in die Datenbank.

**Unsere Sorge:**  
Wenn LV-SBKen Teams auch für BV-Wettbewerbe freischalten könnten (oder umgekehrt), würde das die Zuständigkeitsgrenzen verwischen. Wir müssen klar definieren, welche SBK für welche Freischaltungen zuständig ist.

**Fragen an euch:** 18. Habt ihr bei Swiss Unihockey Wettbewerbe, bei denen Kantonal-Teams neben dem Kantonalspielbetrieb auch in nationalen Wettbewerben antreten (z. B. Pokal)? Wie verwaltet ihr die Freigaben dafür? 19. Wer ist bei euch zuständig für solche Freigaben — die nationale Geschäftsstelle oder der jeweilige Kantonalverband?

---

## Abschluss

Wir sind an euren Erfahrungen interessiert, auch wenn eure Antworten von unserem geplanten Ansatz abweichen — gerade dann sind sie besonders wertvoll. Ihr müsst nicht alle Fragen beantworten; schon Teilantworten oder der Hinweis „das kennen wir bei uns gar nicht" helfen uns weiter.

Wenn ihr Rückfragen habt oder bestimmte Punkte lieber in einem kurzen Gespräch klären wollt, meldet euch gerne.

Vielen Dank!

---

_Floorball Deutschland e. V. – Saisonmanager_  
_Kontakt: d.kehne@floorball.de_
