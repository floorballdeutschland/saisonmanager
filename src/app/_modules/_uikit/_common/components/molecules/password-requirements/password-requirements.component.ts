import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import {
  PASSWORD_MIN_LENGTH,
  PasswordRule,
  passwordRules,
} from 'src/app/_helpers/_utils/password-policy';

// Zeigt die Anforderungen an ein neues Passwort und hakt sie während der
// Eingabe ab. Die Rückmeldung aus der Praxis war, dass man die Regeln bisher
// erst als Fehlermeldung nach dem Absenden zu sehen bekam.
@Component({
  selector: 'fb-password-requirements',
  templateUrl: './password-requirements.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class PasswordRequirementsComponent {
  @Input() password = '';

  readonly minLength = PASSWORD_MIN_LENGTH;

  get rules(): PasswordRule[] {
    return passwordRules(this.password);
  }

  // Vor der ersten Eingabe sind alle Punkte offen, aber noch nichts ist falsch:
  // Dann bleibt die Liste neutral grau statt rot.
  get untouched(): boolean {
    return !this.password;
  }
}
