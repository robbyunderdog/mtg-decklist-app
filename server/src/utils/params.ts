export class BadRequestError extends Error {}

export function requireParam(value: string | string[] | undefined, name: string): string {
  if (typeof value !== "string") {
    throw new BadRequestError(`Invalid ${name}`);
  }
  return value;
}
