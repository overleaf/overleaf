const fs = require('node:fs')
const Path = require('node:path')
const { expect } = require('chai')
const { parseXrefTable } = require('../../../app/js/XrefParser')
const { NoXrefTableError } = require('../../../app/js/Errors')
const PATH_EXAMPLES = 'test/acceptance/fixtures/examples/'
const PATH_SNAPSHOTS = 'test/unit/js/snapshots/pdfjs/'
const EXAMPLES = fs.readdirSync(PATH_EXAMPLES)

function snapshotPath(example) {
  return Path.join(PATH_SNAPSHOTS, example, 'XrefTable.json')
}

function pdfPath(example) {
  return Path.join(PATH_EXAMPLES, example, 'output.pdf')
}

async function loadContext(example) {
  const size = (await fs.promises.stat(pdfPath(example))).size

  let blob
  try {
    blob = await fs.promises.readFile(snapshotPath(example))
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e
    }
  }
  const snapshot = blob ? JSON.parse(blob) : null
  return {
    size,
    snapshot,
  }
}

async function backFillSnapshot(example, size) {
  const table = await parseXrefTable(pdfPath(example), size, () => {})
  await fs.promises.mkdir(Path.dirname(snapshotPath(example)), {
    recursive: true,
  })
  await fs.promises.writeFile(
    snapshotPath(example),
    JSON.stringify(table, null, 2)
  )
  return table
}

describe('pdfjs', function () {
  describe('when the pdf is an empty file', function () {
    it('should yield no entries', async function () {
      const path = 'does/not/matter.pdf'
      let table
      try {
        table = await parseXrefTable(path, 0)
      } catch (e) {
        expect(e).to.be.an.instanceof(NoXrefTableError)
      }
      expect(table).to.not.exist
    })
  })

  for (const example of EXAMPLES) {
    describe(example, function () {
      let size, snapshot
      before('load snapshot', async function () {
        const ctx = await loadContext(example)
        size = ctx.size
        snapshot = ctx.snapshot
      })

      before('back fill new snapshot', async function () {
        if (snapshot === null) {
          console.error('back filling snapshot for', example)
          snapshot = await backFillSnapshot(example, size)
        }
      })

      it('should produce the expected xRef table', async function () {
        const table = await parseXrefTable(pdfPath(example), size, () => {})
        // compare the essential parts of the xref table only
        expect(table.xRefEntries[0]).to.include({ offset: 0 })
        expect(table.xRefEntries.slice(1)).to.deep.equal(
          snapshot.xRefEntries
            .slice(1)
            .filter(xref => xref.uncompressed) // we only use the uncompressed fields
            .map(xref => {
              return { offset: xref.offset, uncompressed: xref.uncompressed } // ignore unused gen field
            })
        )
      })
    })
  }
})
