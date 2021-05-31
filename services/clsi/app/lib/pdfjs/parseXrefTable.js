const fs = require('fs')
const { FSPdfManager } = require('./FSPdfManager')

async function parseXrefTable(path, size) {
  if (size === 0) {
    return []
  }

  const file = await fs.promises.open(path)
  try {
    const manager = new FSPdfManager(0, { fh: file, size })

    await manager.ensureDoc('checkHeader')
    await manager.ensureDoc('parseStartXRef')
    await manager.ensureDoc('parse')
    return manager.pdfDocument.catalog.xref.entries
  } finally {
    file.close()
  }
}

module.exports = {
  parseXrefTable
}
