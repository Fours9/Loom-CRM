export const DOCUMENT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MiB

export const DOCUMENT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export const DOCUMENT_ALLOWED_MIME_REGEXP =
  /^(application\/pdf|image\/jpeg|image\/png)$/;
