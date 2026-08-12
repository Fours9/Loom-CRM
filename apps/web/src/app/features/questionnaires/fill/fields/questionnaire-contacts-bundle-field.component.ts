import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  EmployeeContactsEditorComponent,
  questionnaireContactsAccess,
  type EmployeeContactsEditorAccess,
} from '../../../../shared/employee-contacts/public-api';
import {
  emptyEmployeeContactsBundle,
  type EmployeeContactsBundle,
} from '@loom/employee-contacts';
import { QuestionnaireContactsFieldSession } from './questionnaire-contacts-field.session';

@Component({
  selector: 'loom-questionnaire-contacts-bundle-field',
  standalone: true,
  imports: [EmployeeContactsEditorComponent],
  template: `
    <loom-employee-contacts-editor
      [bundle]="displayBundle"
      [access]="access"
      [editing]="editable"
      (bundleChange)="onBundleChange($event)"
    />
  `,
})
export class QuestionnaireContactsBundleFieldComponent implements OnChanges {
  @Input({ required: true }) answers!: Record<string, unknown>;
  @Input({ required: true }) profileMirror!: Record<string, unknown>;
  @Input() employeeId: string | null = null;
  @Input() editable = true;
  @Output() readonly bundleChange = new EventEmitter<EmployeeContactsBundle>();

  displayBundle: EmployeeContactsBundle = emptyEmployeeContactsBundle();

  private readonly session = new QuestionnaireContactsFieldSession();

  get access(): EmployeeContactsEditorAccess {
    return questionnaireContactsAccess(this.editable);
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.displayBundle = this.session.readDisplay({
      answers: this.answers,
      profileMirror: this.profileMirror,
      employeeId: this.employeeId,
    });
  }

  onBundleChange(bundle: EmployeeContactsBundle): void {
    this.bundleChange.emit(this.session.commitEdit(bundle));
  }
}
