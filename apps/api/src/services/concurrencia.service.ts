export class ConflictError extends Error {
  statusCode = 409;

  constructor(message = 'Los datos cambiaron en otro dispositivo. Recarga e intenta de nuevo.') {
    super(message);
    this.name = 'ConflictError';
  }
}

export function checkVersion(actual: number, sent?: number | null, mensaje?: string) {
  if (sent !== undefined && sent !== null && sent !== actual) {
    throw new ConflictError(mensaje);
  }
}