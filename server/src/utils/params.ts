// Small shared helpers for validating request input in controllers.

// Thrown for any "the client sent something invalid" condition; the global error handler
// (middleware/errorHandler.ts) turns this into a 400 response with the message shown as-is.
export class BadRequestError extends Error {}

// Express route params are typed as `string | string[] | undefined` (a param can repeat in
// some route patterns); this narrows to a single string or throws, so callers don't have to
// re-check the type on every route.
export function requireParam(value: string | string[] | undefined, name: string): string {
  if (typeof value !== "string") {
    throw new BadRequestError(`Invalid ${name}`);
  }
  return value;
}
