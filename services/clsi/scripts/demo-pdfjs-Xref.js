const fs = require('node:fs')
const { parseXrefTable } = require('../app/lib/pdfjs/parseXrefTable')

const pdfPath = process.argv[2]

async function main() {
  const size = (await fs.promises.stat(pdfPath)).size
  const { xRefEntries } = await parseXrefTable(pdfPath, size)
  console.log('Xref entries', xRefEntries)
}

main().catch(console.error)
