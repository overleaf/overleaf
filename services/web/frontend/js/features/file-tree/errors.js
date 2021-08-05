export class InvalidFilenameError extends Error {
  constructor() {
    super('invalid filename')
  }
}

export class BlockedFilenameError extends Error {
  constructor() {
    super('blocked filename')
  }
}

export class DuplicateFilenameError extends Error {
  constructor() {
    super('duplicate filename')
  }
}

export class DuplicateFilenameMoveError extends Error {
  constructor() {
    super('duplicate filename on move')
  }
}
