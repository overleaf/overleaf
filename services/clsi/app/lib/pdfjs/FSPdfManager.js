const { PDFDocument } = require('pdfjs-dist/lib/core/document')
const { LocalPdfManager } = require('pdfjs-dist/lib/core/pdf_manager')
const { MissingDataException } = require('pdfjs-dist/lib/core/core_utils')
const { FSStream } = require('./FSStream')

class FSPdfManager extends LocalPdfManager {
  constructor(docId, { fh, size, checkDeadline }) {
    const nonEmptyDummyBuffer = Buffer.alloc(1, 0)
    super(docId, nonEmptyDummyBuffer)
    this.stream = new FSStream(fh, 0, size, null, null, checkDeadline)
    this.pdfDocument = new PDFDocument(this, this.stream)
  }

  async ensure(obj, prop, args) {
    try {
      const value = obj[prop]
      if (typeof value === 'function') {
        return value.apply(obj, args)
      }
      return value
    } catch (ex) {
      if (!(ex instanceof MissingDataException)) {
        throw ex
      }
      await this.requestRange(ex.begin, ex.end)
      return this.ensure(obj, prop, args)
    }
  }

  requestRange(begin, end) {
    return this.stream.requestRange(begin, end)
  }

  requestLoadedStream() {}

  onLoadedStream() {}

  terminate(reason) {}
}

module.exports = {
  FSPdfManager,
}
