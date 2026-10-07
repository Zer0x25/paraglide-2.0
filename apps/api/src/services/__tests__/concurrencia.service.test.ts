import { describe, it, expect } from 'vitest';
import { ConflictError, checkVersion } from '../concurrencia.service';

describe('Concurrencia Service', () => {
  describe('ConflictError', () => {
    it('should create an error with default message and statusCode 409', () => {
      const error = new ConflictError();
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ConflictError');
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Los datos cambiaron en otro dispositivo. Recarga e intenta de nuevo.');
    });

    it('should create an error with a custom message', () => {
      const customMessage = 'Custom conflict message';
      const error = new ConflictError(customMessage);
      expect(error.message).toBe(customMessage);
      expect(error.statusCode).toBe(409);
    });
  });

  describe('checkVersion', () => {
    it('should not throw if sent is undefined', () => {
      expect(() => checkVersion(1, undefined)).not.toThrow();
    });

    it('should not throw if sent is null', () => {
      expect(() => checkVersion(1, null)).not.toThrow();
    });

    it('should not throw if sent is equal to actual', () => {
      expect(() => checkVersion(1, 1)).not.toThrow();
    });

    it('should throw ConflictError if sent is defined, not null, and not equal to actual', () => {
      expect(() => checkVersion(2, 1)).toThrow(ConflictError);
    });

    it('should throw ConflictError with a custom message if provided', () => {
      const customMessage = 'Version mismatch';
      expect(() => checkVersion(2, 1, customMessage)).toThrow(customMessage);

      try {
        checkVersion(2, 1, customMessage);
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictError);
        expect((error as ConflictError).message).toBe(customMessage);
        expect((error as ConflictError).statusCode).toBe(409);
      }
    });
  });
});
