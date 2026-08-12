export class InvalidEmployeeContactsBundle extends Error {
  readonly code = 'InvalidEmployeeContactsBundle';

  constructor(message: string) {
    super(message);
    this.name = 'InvalidEmployeeContactsBundle';
  }
}
