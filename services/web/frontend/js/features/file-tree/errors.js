export class InvalidFilenameError extends Error {
  constructor() {
    super('invalid filename')
  }
}

export class DuplicateFilenameError extends Error {
  constructor() {
    super('duplicate filename')
  }
}
