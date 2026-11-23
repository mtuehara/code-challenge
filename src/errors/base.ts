export abstract class BaseError extends Error {
  abstract readonly code: string;
}
