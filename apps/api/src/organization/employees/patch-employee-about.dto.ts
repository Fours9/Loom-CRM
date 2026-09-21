import { IsObject, IsString } from 'class-validator';

export class PatchEmployeeAboutSubtabDto {
  @IsString()
  subtabId!: string;

  @IsObject()
  values!: Record<string, unknown>;
}
