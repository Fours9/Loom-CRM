import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'questionnaire_assignment_code_counters' })
export class QuestionnaireAssignmentCodeCounter {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  prefix!: string;

  @Column({ name: 'next_value', type: 'int' })
  nextValue!: number;
}
