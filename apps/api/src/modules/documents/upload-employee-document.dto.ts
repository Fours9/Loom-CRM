import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
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

  /**
   * Multipart: omitted / null / '' → false (legacy clients).
   * Never use Boolean(value) — Boolean('false') === true.
   */
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return false;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isConfidential = false;
}
