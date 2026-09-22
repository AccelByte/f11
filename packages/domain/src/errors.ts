export class DomainError extends Error {
  readonly code: string;
  readonly details: Readonly<Record<string, string | number | boolean | null>>;

  constructor(
    code: string,
    message: string,
    details: Readonly<Record<string, string | number | boolean | null>> = {},
  ) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}
