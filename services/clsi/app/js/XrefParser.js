const { NoXrefTableError } = require('./Errors')
const fs = require('node:fs')
const { O_RDONLY, O_NOFOLLOW } = fs.constants
const MAX_XREF_FILE_SIZE = 1024 * 1024

/**  Parse qpdf --show-xref output to get a table of xref entries
 *
 * @param {string} filePath
 * @param {number} pdfFileSize
 * @returns
 */
async function parseXrefTable(filePath, pdfFileSize) {
  try {
    // the xref table will be written to output.pdfxref when available
    const xRefFilePath = filePath + 'xref'
    // check the size of the file (as it is untrusted)
    const stats = await fs.promises.stat(xRefFilePath)
    if (!stats.isFile()) {
      throw new NoXrefTableError('xref file invalid type')
    }
    if (stats.size === 0) {
      throw new NoXrefTableError('xref file empty')
    }
    if (stats.size > MAX_XREF_FILE_SIZE) {
      throw new NoXrefTableError('xref file too large')
    }
    const content = await fs.promises.readFile(xRefFilePath, {
      encoding: 'ascii',
      flag: O_RDONLY | O_NOFOLLOW,
    })
    // the qpdf xref table output looks like this:
    //
    //    3/0: uncompressed; offset = 194159
    //
    // we only need the uncompressed objects
    const matches = content.matchAll(
      // put an upper limit of 10^10 on all the matched numbers for safety
      // ignore the generation id in "id/gen"
      // in a linearized pdf all objects must have generation number 0
      /^\d{1,9}\/\d{1,9}: uncompressed; offset = (\d{1,9})$/gm
    )
    // include a zero-index object for backwards compatibility with
    // our existing xref table parsing code
    const xRefEntries = [{ offset: 0 }]
    // extract all the xref table entries
    for (const match of matches) {
      const offset = parseInt(match[1], 10)
      xRefEntries.push({ offset, uncompressed: true })
    }
    if (xRefEntries.length === 1) {
      throw new NoXrefTableError('xref file has no objects')
    }
    return { xRefEntries }
  } catch (err) {
    if (err instanceof NoXrefTableError) {
      throw err
    } else if (err.code) {
      throw new NoXrefTableError(`xref file error ${err.code}`)
    } else {
      throw new NoXrefTableError('xref file parse error')
    }
  }
}

module.exports = {
  parseXrefTable,
}
