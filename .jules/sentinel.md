## 2024-05-18 - Insecure PRNG in Pasajeros Service
**Vulnerability:** Weak PRNG (`Math.random()`) was being used for passenger ID generation, which is predictable and may cause collisions or security issues.
**Learning:** For predictable IDs or any sensitive random generation, `Math.random()` should be avoided.
**Prevention:** Use cryptographically secure PRNGs like `crypto.randomInt()` or `crypto.randomBytes()` from the Node.js `crypto` module for generating identifiers.

## 2024-05-24 - Secure PRNG for Tie-breaking
**Vulnerability:** Weak PRNG (`Math.random()`) used for business logic in `vuelos.matching.ts`.
**Learning:** `Math.random()` generates predictable values, making randomness-based algorithms like fair tie-breakers exploitable. Replacing it with a cryptographically secure pseudo-random number generator (CSPRNG) ensures unpredictability.
**Prevention:** Use `node:crypto` (`crypto.randomBytes`) for backend logic that requires secure and unpredictable randomness.

## 2025-02-14 - Missing Input Validation in GastosController
**Vulnerability:** The Gastos controller accepted `request.body as any` and failed to properly validate incoming types or prevent unexpected data payloads, which could lead to type confusion attacks or injection if the downstream layer assumes data conforms to the expected type.
**Learning:** Type casting `as any` and manual existence checks are insufficient for validation and easily bypass security limits. Centralized Zod schemas should be strictly enforced at the perimeter for all incoming request bodies.
**Prevention:** Always use structural validation (like Zod) to explicitly type-check and sanitize incoming data from API requests instead of generic structural or boolean existence checks.
