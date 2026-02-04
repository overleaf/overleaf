import fs from 'node:fs'
import XrefParser from '../app/js/XrefParser.js'

const pdfPath = process.argv[2]

async function main() {
  const size = (await fs.promises.stat(pdfPath)).size
  const { xRefEntries } = await XrefParser.parseXrefTable(pdfPath, size)
  console.log('Xref entries', xRefEntries)
}

main().catch(console.error)
