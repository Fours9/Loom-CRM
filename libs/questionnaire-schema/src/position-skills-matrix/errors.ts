export class InvalidPositionSkillsMatrix extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPositionSkillsMatrix';
  }
}
