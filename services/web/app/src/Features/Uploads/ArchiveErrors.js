const OError = require('@overleaf/o-error')

class InvalidZipFileError extends OError {
  constructor(options) {
    super({
      message: 'invalid_zip_file',
      ...options
    })
  }
}

class EmptyZipFileError extends InvalidZipFileError {
  constructor(options) {
    super({
      message: 'empty_zip_file',
      ...options
    })
  }
}

class ZipContentsTooLargeError extends InvalidZipFileError {
  constructor(options) {
    super({
      message: 'zip_contents_too_large',
      ...options
    })
  }
}

module.exports = {
  InvalidZipFileError,
  EmptyZipFileError,
  ZipContentsTooLargeError
}
