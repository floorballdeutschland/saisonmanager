import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NotificationService, SessionService } from '@floorball/core';
import { Router } from '@angular/router';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private sessionService: SessionService,
    private _router: Router,
    private _notificationService: NotificationService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  // Ein abgelaufener Spielsekretariats-Link wird nur einmal gemeldet, siehe
  // 401-Zweig. Der Interceptor ist ein Singleton, der Merker hält also für die
  // Lebensdauer der Registerkarte.
  private secretaryLinkRejected = false;

  // Fehlerdetails aus dem Response-Body ziehen. Rails-Endpunkte liefern
  // wahlweise { message }, { error } oder { errors: [...] } (z. B. bei 422
  // aus ActiveModel-Validierungen) — alle drei Formen auswerten, damit der
  // Interceptor die spezifische Meldung zeigt statt einer generischen (#84).
  private errorDetail(err: {
    error?: { message?: string; error?: unknown; errors?: string[] };
  }): string | undefined {
    if (err.error?.message) return err.error.message;
    if (err.error?.error) return this.readableDetail(err.error.error);
    if (Array.isArray(err.error?.errors) && err.error.errors.length > 0) {
      return err.error.errors.join(', ');
    }
    return undefined;
  }

  // `error` ist nicht überall ein Text: Endpunkte, die `model.errors` ohne
  // `full_messages` rendern, liefern den Validierungs-Hash `{ feld: [...] }`.
  // Ungeprüft weitergereicht wird der im Meldungs-Template zu
  // "[object Object]" — eine Meldung, die den Kanal belegt, ohne etwas zu
  // sagen. Deshalb hier flach ziehen und im Zweifel lieber nichts liefern,
  // damit der generische Text greift.
  private readableDetail(detail: unknown): string | undefined {
    if (typeof detail === 'string') return detail;

    if (detail && typeof detail === 'object') {
      const meldungen = Object.values(detail as Record<string, unknown>)
        .flat()
        .filter((eintrag): eintrag is string => typeof eintrag === 'string');

      if (meldungen.length > 0) return meldungen.join(', ');
    }

    return undefined;
  }

  public intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((err) => {
        // Beim Server-Rendering (Prerender) keine Browser-Seiteneffekte
        // (logout, Navigation, Notifications). Zudem ein echtes Error-Objekt
        // werfen, damit ein fehlgeschlagener API-Call den Prerender-Worker
        // nicht an einem String-Reject hängen lässt ("catch clause variable
        // is not an Error instance"). Im Browser wird weiter unten die
        // ursprüngliche HttpErrorResponse weitergereicht (Objekt mit .status,
        // .message und .error), damit Component-Handler auf diese Felder
        // zugreifen können.
        if (!isPlatformBrowser(this.platformId)) {
          const serverError = this.errorDetail(err) || err.statusText;
          return throwError(() => new Error(serverError));
        }

        // Die Bestätigungsseite für E-Mail-Änderungen (/email-bestaetigen)
        // rendert Fehler (ungültiger/abgelaufener Link) als eigene Ansicht –
        // keine globalen Toasts oder Redirects für diesen Endpoint.
        if (request.url.includes('user/email/confirm')) {
          return throwError(() => err);
        }

        // „Passwort vergessen" meldet Fehler selbst (SessionService), inklusive
        // der Server-Nachricht. Ohne diese Ausnahme zeigt der generische
        // 4xx-Zweig weiter unten dieselbe Meldung ein zweites Mal (#84).
        if (request.url.includes('lost_password')) {
          return throwError(() => err);
        }

        // Die Abgabeseite für das Schiri-Feedback per Einmal-Link
        // (/schiri-feedback/abgeben/:token) rendert jeden Fehlerzustand als
        // eigene Ansicht. Ohne diese Ausnahme käme zusätzlich ein Toast, und
        // schlimmer: 401 würde eine Abmeldung samt Weiterleitung auf /login
        // auslösen und 403 auf die Startseite umleiten – für Personen, die hier
        // bewusst ohne Benutzerkonto unterwegs sind, eine Sackgasse.
        if (request.url.includes('referee_feedback_invitations')) {
          return throwError(() => err);
        }

        // Der ausdrücklich angestoßene Reset-Mail-Versand meldet einen
        // gescheiterten Versand als 502 samt Klartext-Nachricht. Der generische
        // 5xx-Zweig weiter unten würde die verschlucken und stattdessen
        // „Server-Fehler" zeigen, zusätzlich zum Toast des Component-Handlers.
        if (request.url.includes('trigger_password_reset')) {
          return throwError(() => err);
        }

        // Das Spielsekretariat per Einmal-Link (/spielsekretariat?token=…)
        // rendert jeden Fehlerzustand als eigene Ansicht, genau wie das
        // Schiri-Feedback oben. Ohne diese Ausnahme käme zum abgelaufenen Link
        // (410) ein zweiter, nicht selbstschließender Toast mit demselben Text,
        // und ein 401 würde jemanden abmelden und auf /login schicken, der hier
        // bewusst ohne Benutzerkonto arbeitet.
        if (request.url.includes('public/secretary')) {
          return throwError(() => err);
        }

        // Lizenzdokumente sind ein Nachschlag zu einer bereits geöffneten
        // Seite, keine eigene Ansicht. Ein 403 darauf heißt „diese Unterlagen
        // nicht", nicht „diese Seite nicht" – der generische 403-Zweig weiter
        // unten warf die Nutzerin bzw. den Nutzer aber auf die Startseite,
        // mitten aus der Spielerbearbeitung heraus. Beobachtet am 08.08. an
        // drei Spielern in Folge (Sentry SAISONMANAGER-2D): öffnen,
        // rausfliegen, zurücknavigieren, wieder rausfliegen.
        //
        // Die aufrufenden Ansichten melden den Fehlschlag selbst an Ort und
        // Stelle (player-edit über documentsFailed, license-team-detail über
        // uploadError), es geht also nichts still verloren.
        //
        // Die Auswahlliste der Dokumentarten am Spielerprofil gehört dazu: Sie
        // hängt an derselben Rechteprüfung wie die Dokumente selbst, kommt also
        // im selben Fall mit 403 zurück. Ohne diese Ausnahme wäre der Fix von
        // #240 durch die Hintertür wieder aufgehoben. Gemeint ist nur der
        // spielerbezogene Abruf, nicht der Katalog unter admin/document_types,
        // der eine eigene Ansicht hat.
        if (
          request.url.includes('license_documents') ||
          /\/players\/\d+\/document_types/.test(request.url)
        ) {
          return throwError(() => err);
        }

        // Die Gespann-Historie ist ein Nachschlag zur bereits geöffneten
        // Ansetzung, genau wie die Lizenzdokumente oben: Sie sortiert im
        // Dropdown von Schiri 2 die Gespannpartner nach oben. Ein 403 darauf
        // heißt „diese Historie nicht", nicht „diese Ansetzung nicht".
        //
        // Der 403 ist keine Randlage: Die Ansetzungsliste ist über den
        // Spielbetrieb des Spiels gescopt, `can_access_referee?` dagegen über
        // die Person (Vereine des LV bzw. eigener Spielbetrieb). Trägt eine
        // bestehende Ansetzung jemanden von außerhalb dieses Personen-Scopes
        // (LV-übergreifend durch FD/Admin angesetzt, oder eine ausgelaufene
        // Vereinsfreigabe), fragt schon das Hineinklicken in das Feld für
        // Schiri 2 eine fremde Person ab. Ohne diese Ausnahme wirft ein reiner
        // Fokuswechsel den Ansetzer auf die Startseite, mitsamt Filtern und
        // halb eingetragenen Zeilen. Dritter Fall dieser Bauart nach #240
        // (Lizenzdokumente) und api#437 (Spielbericht).
        //
        // Gilt für alle Status: Ohne Historie bleibt die alphabetische
        // Kandidatenliste stehen und die im Profil hinterlegte Nummer wird
        // weiterhin vorgezogen, es geht also keine Entscheidung verloren. Ein
        // Toast je Zeile wäre bei zwölf Zeilen zwölf gestapelte Meldungen.
        // Gemeint ist nur der personenbezogene Abruf; die Eigensicht unter
        // `referee/history/partners` hat eine eigene Ansicht und bleibt außen.
        if (/\/referees\/\d+\/partners(\.json)?$/.test(request.url)) {
          return throwError(() => err);
        }

        // Anfragen im Spielsekretariats-Modus tragen den Einmal-Token als
        // Kopfzeile (SecretaryTokenInterceptor, der in der Kette vor diesem
        // steht). Für sie gibt es keine Sitzung, die man abmelden könnte, und
        // keine Startseite, auf die man sinnvoll zurückfällt: Wer den
        // Spielbericht an einem solchen Link führt, hat kein Benutzerkonto und
        // findet nach einer Weiterleitung auf /login nicht zurück. Gemeldet wird
        // trotzdem, nur eben ohne Rauswurf.
        //
        // Der fehlende Login gehört zur Bedingung: Der Token wird nirgends
        // gelöscht, eine Registerkarte, in der einmal ein Sekretariats-Link
        // offen war, schickt ihn also dauerhaft mit. Ohne diese zweite Hälfte
        // verlöre eine Person, die sich danach in derselben Registerkarte
        // anmeldet, bei abgelaufener Sitzung die Abmeldung samt Weiterleitung
        // und bekäme stattdessen einen Hinweis auf einen Link, mit dem sie nicht
        // arbeitet.
        const secretaryMode =
          request.headers.has('X-Secretary-Token') &&
          !this.sessionService.currentUserValue;

        // Der Spielbericht ist eine Arbeitsfläche, keine Seite, die man betritt
        // oder nicht. Ein 403 auf eine einzelne Aktion darin heißt „dieses Feld
        // nicht", nicht „dieser Spielbericht nicht": Ob die Bedienelemente
        // überhaupt erscheinen, entscheidet bereits `game.permission`
        // (`edit_game_report`, siehe canEditGame() in match-report.component.ts).
        // Ohne diese Ausnahme sprang die Oberfläche mitten im laufenden Spiel auf
        // die Startseite, und zwar bei jedem weiteren Versuch erneut. Beobachtet
        // am 15.08. bei der DM der Damen: 19 abgewiesene Speicherungen von
        // Spielsekretariat, Zeitnehmer, Livestream-Link, Zuschauerzahl,
        // Anwurfzeit und Auszeiten, jede mit Rauswurf.
        //
        // Alle Endpunkte unter `user/games/` sind Aktionen aus einem bereits
        // geöffneten Bericht heraus, keiner davon ist ein Seiteneinstieg. Die
        // SBK-Übersicht (match-report-index.component.ts) nutzt mit `scan` und
        // `game_status` zwei davon ebenfalls; auch dort ist eine Liste der
        // falsche Ort für einen Rauswurf, die Ausweitung ist also gewollt.
        //
        // Bewusst ohne frühen return wie bei den Lizenzdokumenten weiter oben:
        // Der Bericht braucht den 401-Zweig (Sitzung läuft mitten im Spiel ab)
        // und er braucht die Meldung, sonst sieht niemand, dass die Eingabe
        // nicht angekommen ist.
        //
        // Die Ursache der 403 vom 15.08. lag in der API (der ausrichtende Verein
        // war von den Kopfdaten ausgesperrt), behoben in
        // floorballdeutschland/saisonmanager-api#437. Diese Ausnahme bleibt
        // unabhängig davon richtig: Ein einzelnes abgelehntes Feld darf niemanden
        // aus einem laufenden Spielbericht werfen, gleich aus welchem Grund.
        const matchReportRequest = request.url.includes('user/games/');

        // Anlegen, Deaktivieren und Reaktivieren einer Person sind Aktionen aus
        // einer bereits geöffneten Arbeitsfläche heraus: aus der Zeile der
        // Vereinsspielerliste oder aus dem geöffneten Formular. Ein 403 darauf
        // heißt „diese Aktion nicht", nicht „diese Seite nicht" – der
        // generische Zweig weiter unten warf dagegen auf die Startseite, mitten
        // aus der Liste heraus, und nahm dabei die halb eingetragenen
        // Stammdaten des Formulars mit. Vierter Fall dieser Bauart nach #240
        // (Lizenzdokumente), api#437 (Spielbericht) und der Gespann-Historie.
        //
        // Praktisch wird der 403 mit api#530: Die Entscheidung über den
        // Vereinsbestand liegt seither beim Vereinsmanager, ein noch offener
        // Tab einer Teammanager*in trifft also auf eine Absage. Die Meldung
        // nennt die zuständige Rolle und gehört genau dorthin, wo geklickt
        // wurde. Bewusst ohne frühen return: Ohne Meldung sähe niemand, dass
        // die Aktion nicht angekommen ist.
        const playerClubDecision =
          /admin\/players(\.json)?$/.test(request.url) ||
          /admin\/players\/\d+\/(de|re)activate(\.json)?$/.test(request.url);

        if (err.status === 401 && !request.url.includes('login.json')) {
          if (secretaryMode) {
            // Nur einmal je Sitzung: Die Spielansicht fragt die internen Felder
            // alle 30 Sekunden neu ab (match.component.ts). Ohne die Sperre
            // stapelt ein abgelaufener Link zwei Meldungen pro Minute
            // übereinander, die sich nicht von selbst schließen.
            if (!this.secretaryLinkRejected) {
              this.secretaryLinkRejected = true;
              this._notificationService.error(
                'Der Spielsekretariats-Link gilt nicht mehr. Bitte einen neuen Link anfordern.',
                { autoClose: false, keepAfterRouteChange: true }
              );
            }
          } else {
            const returnUrl = this._router.url;
            this.sessionService.logout(false, true, 'Bitte einloggen.', false);
            this._router.navigate(['/login'], { queryParams: { returnUrl } });
          }
        }

        if (err.status === 403) {
          // Im Spielbericht bleibt die Ansicht stehen, es gibt also keinen
          // Routenwechsel mehr. Ausgerechnet die Umleitung war bisher aber das
          // Einzige, was alte Meldungen aufgeräumt hat: Die Notification-
          // Komponente hängt jede Meldung an (`notifications.push`) und leert
          // die Liste nur bei `NavigationStart`. Mit `autoClose: false` blieben
          // bei 19 abgewiesenen Speicherungen 19 deckungsgleiche Hinweise
          // stehen, ohne Versatz übereinander gelegt und einzeln wegzuklicken.
          // Deshalb schließt diese Meldung im Bericht von selbst; die Eingabe
          // bleibt im Feld stehen, ein kurzer Hinweis genügt also. Dasselbe
          // Stapelproblem löst der 401-Zweig oben über `secretaryLinkRejected`.
          const staysOnPage = matchReportRequest || playerClubDecision;
          this._notificationService.error(
            'Berechtigungsfehler: ' + (this.errorDetail(err) || 'Kein Zugriff'),
            {
              autoClose: staysOnPage,
              keepAfterRouteChange: !staysOnPage,
            }
          );
          if (!secretaryMode && !staysOnPage) {
            this._router.navigate(['/']);
          }
        }

        if (err.status === 404 && !request.url.includes('/user/referees/')) {
          // Nur Status und Pfad, nicht das ganze Fehlerobjekt: Sentry legt
          // console-Aufrufe als Wegmarken ab und serialisiert deren Argumente
          // mehrere Ebenen tief. Ein HttpErrorResponse trägt in .error den
          // geparsten Antwortkörper, bei Verwaltungsabrufen also Spieler- und
          // Schiedsrichter-Datensätze (#230).
          console.error(`HTTP 404: ${request.method} ${request.url}`);
          this._notificationService.error(
            'Nicht gefunden: ' +
              (this.errorDetail(err) || 'Ressource nicht gefunden'),
            {
              autoClose: false,
              keepAfterRouteChange: true,
            }
          );
        }

        // Übrige 4xx (z. B. 400, 409, 422) sichtbar machen. Bisher wurden diese
        // stillschweigend verschluckt ("der Button tut nichts"). 401/403/404
        // sind oben bereits gesondert behandelt.
        if (
          err.status >= 400 &&
          err.status < 500 &&
          ![401, 403, 404].includes(err.status)
        ) {
          this._notificationService.error(
            this.errorDetail(err) ||
              'Die Eingabe konnte nicht verarbeitet werden.',
            { autoClose: false, keepAfterRouteChange: false }
          );
        }

        if (err.status >= 500) {
          this._notificationService.error(
            'Server-Fehler. Bitte versuche es später erneut.',
            { autoClose: false, keepAfterRouteChange: false }
          );
        }

        if (err.status === 0) {
          this._notificationService.error(
            'Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.',
            { autoClose: false, keepAfterRouteChange: false }
          );
        }

        // Fehler mit einem Erfolgsstatus erreichen keinen der Zweige oben:
        // Angular baut eine HttpErrorResponse mit unverändertem Status, wenn
        // der Body einer 2xx-Antwort kein gültiges JSON ist – etwa eine
        // Captive-Portal- oder Wartungsseite, die mit 200 ausgeliefert wird.
        // Ohne diesen Zweig bleibt so ein Fehlschlag völlig stumm, seit
        // Komponenten sich auf den Interceptor verlassen statt auf einen
        // eigenen Toast (#228).
        if (err.status > 0 && err.status < 400) {
          // Wie oben: kein ganzes Fehlerobjekt in die Konsole, sonst landet der
          // Antwortkörper über die Sentry-Wegmarken im Monitoring (#230).
          console.error(
            `Unlesbare Antwort (${err.status}): ${request.method} ${request.url}`
          );
          this._notificationService.error(
            'Die Antwort des Servers war unlesbar. Bitte versuche es erneut.',
            { autoClose: false, keepAfterRouteChange: false }
          );
        }

        // Die ursprüngliche HttpErrorResponse weiterreichen (statt eines bloßen
        // Strings): aufrufende error-Handler können so auf .status, .message und
        // den .error-Body (inkl. errors[]) zugreifen.
        return throwError(() => err);
      })
    );
  }
}
