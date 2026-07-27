import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import {
  EMPLOYEE_DOCUMENT_TYPES,
  type EmployeeDocumentType,
} from './document-types';

export class UploadEmployeeDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsIn([...EMPLOYEE_DOCUMENT_TYPES])
  documentType!: EmployeeDocumentType;
}
