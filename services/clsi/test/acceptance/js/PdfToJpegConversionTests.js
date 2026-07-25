import Client from './helpers/Client.js'
import ClsiApp from './helpers/ClsiApp.js'
import Path from 'node:path'
import fs from 'node:fs/promises'
import { promisify } from 'node:util'
import { execFile as execFileCb } from 'node:child_process'
import { expect } from 'chai'

const execFile = promisify(execFileCb)

const FIXTURE_PDF = Path.join(import.meta.dirname, '../fixtures/minimal.pdf')

const MODE_EXPECTATIONS = {
  preview: { width: 794 },
  thumbnail: { width: 190 },
}

async function writeResponseToTempfile(response) {
  const buffer = Buffer.from(await response.arrayBuffer())
  const tmpPath = `/tmp/clsi-acceptance-pdf-to-jpeg-${crypto.randomUUID()}.jpg`
  await fs.writeFile(tmpPath, buffer)
  return { tmpPath, buffer }
}

describe('pdf-to-jpeg conversion', function () {
  before(async function () {
    await ClsiApp.ensureRunning()
  })

  for (const [mode, { width: expectedWidth }] of Object.entries(
    MODE_EXPECTATIONS
  )) {
    describe(`with mode=${mode}`, function () {
      let response
      let tmpPath
      let buffer

      before(async function () {
        response = await Client.convertPdfToJpeg(FIXTURE_PDF, mode)
        expect(response.status).to.equal(200)
        ;({ tmpPath, buffer } = await writeResponseToTempfile(response))
      })

      after(async function () {
        if (tmpPath) {
          await fs.unlink(tmpPath).catch(() => {})
        }
      })

      it('returns a JPEG (per `file`)', async function () {
        const { stdout } = await execFile('file', ['--brief', tmpPath])
        expect(stdout).to.match(/JPEG image data/)
      })

      it(`has the expected width of ${expectedWidth}px`, async function () {
        const { stdout } = await execFile('identify', [
          '-format',
          '%w %h',
          tmpPath,
        ])
        const [width, height] = stdout.trim().split(' ').map(Number)
        expect(width).to.equal(expectedWidth)
        // A4 portrait is taller than wide; height must be positive and
        // larger than the width (so the aspect ratio was preserved).
        expect(height).to.be.greaterThan(width)
      })

      it('returns a non-empty body matching Content-Length', function () {
        expect(buffer.length).to.be.greaterThan(0)
        expect(buffer.length).to.equal(
          Number(response.headers.get('content-length'))
        )
      })
    })
  }

  describe('with an unsupported mode', function () {
    it('returns 400', async function () {
      const response = await Client.convertPdfToJpeg(FIXTURE_PDF, 'not-a-mode')
      expect(response.status).to.equal(400)
    })
  })
})
