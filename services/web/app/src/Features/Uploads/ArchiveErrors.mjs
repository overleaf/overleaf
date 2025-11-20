import Errors from '../Errors/Errors.js'

export class InvalidZipFileError extends Errors.BackwardCompatibleError {
  constructor(options) {
    super({
      message: 'invalid_zip_file',
      ...options,
    })
  }
}

export class EmptyZipFileError extends InvalidZipFileError {
  constructor(options) {
    super({
      message: 'empty_zip_file',
      ...options,
    })
  }
}

export class ZipContentsTooLargeError extends InvalidZipFileError {
  constructor(options) {
    super({
      message: 'zip_contents_too_large',
      ...options,
    })
  }
}

export default {
  InvalidZipFileError,
  EmptyZipFileError,
  ZipContentsTooLargeError,
}
