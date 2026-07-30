// Regeln für selbst gewählte Passwörter, spiegelt PasswordPolicy im Backend
// (app/services/password_policy.rb). Der Server bleibt die verbindliche
// Prüfung; hier geht es darum, die Anforderungen schon während der Eingabe zu
// zeigen, statt sie erst als Fehlermeldung nach dem Absenden zu liefern.
export const PASSWORD_MIN_LENGTH = 12;

export interface PasswordRule {
  /** i18n-Schlüssel unterhalb von `passwordRequirements` */
  key: 'minLength' | 'uppercase' | 'digit';
  met: boolean;
}

export function passwordRules(password: string): PasswordRule[] {
  const value = password ?? '';

  return [
    { key: 'minLength', met: value.length >= PASSWORD_MIN_LENGTH },
    { key: 'uppercase', met: /[A-ZÄÖÜ]/.test(value) },
    { key: 'digit', met: /\d/.test(value) },
  ];
}

export function passwordMeetsPolicy(password: string): boolean {
  return passwordRules(password).every((rule) => rule.met);
}
