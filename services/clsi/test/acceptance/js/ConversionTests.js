import Client from './helpers/Client.js'
import ClsiApp from './helpers/ClsiApp.js'
import Path from 'node:path'
import fs from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { buffer } from 'node:stream/consumers'
import yauzl from 'yauzl'
import { expect } from 'chai'
import { fetchStreamWithResponse } from '@overleaf/fetch-utils'
import Settings from '@overleaf/settings'

describe('Conversions', function () {
  describe('docx conversion', function () {
    before(async function () {
      await ClsiApp.ensureRunning()
      try {
        this.body = await Client.compile(this.project_id, this.request)
      } catch (error) {
        this.error = error
      }
    })

    it('should convert file to docx', async function () {
      const sourcePath = Path.join(
        import.meta.dirname,
        '../fixtures/conversion-source.docx'
      )
      const outputStream = fs.createWriteStream(
        '/tmp/clsi_acceptance_tests_' + crypto.randomUUID() + '.zip'
      )
      const { stream } = await Client.convertDocument(sourcePath, 'docx')
      await pipeline(stream, outputStream)

      await new Promise((resolve, reject) => {
        yauzl.open(outputStream.path, { lazyEntries: true }, (err, zipfile) => {
          if (err) {
            return reject(err)
          }
          zipfile.on('error', reject)
          zipfile.on('end', resolve)
          zipfile.readEntry()
          zipfile.on('entry', entry => {
            if (entry.fileName === 'main.tex') {
              zipfile.openReadStream(entry, (err, readStream) => {
                if (err) {
                  return reject(err)
                }
                let data = ''
                readStream.on('data', chunk => {
                  data += chunk.toString()
                })
                readStream.on('end', () => {
                  try {
                    expect(data).to.include('\\begin{document}')
                    expect(data).to.include(
                      '\\[x = \\frac{- b \\pm \\sqrt{b^{2} - 4ac}}{2a}\\]'
                    )
                    zipfile.readEntry()
                  } catch (err) {
                    reject(err)
                  }
                })
              })
            } else if (entry.fileName === 'media/') {
              // Skip the media directory entry
              zipfile.readEntry()
            } else if (entry.fileName.startsWith('media/')) {
              expect(entry.fileName).to.equal('media/image1.png')
              zipfile.readEntry()
            } else {
              reject(new Error('Unexpected file in zip: ' + entry.fileName))
            }
          })
        })
      })
    })

    it('should fail with 422 and surface pandoc stderr when file is not a docx', async function () {
      const sourcePath = Path.join(
        import.meta.dirname,
        '../fixtures/minimal.pdf'
      )
      const { status, body } = await Client.convertDocument(sourcePath, 'docx')
      expect(status).to.equal(422)
      expect(body.error).to.include("couldn't unpack docx container")
    })
  })

  describe('project-to-document conversion (responseFormat=json)', function () {
    before(async function () {
      await ClsiApp.ensureRunning()
    })

    it('returns ids and serves the docx output via nginx', async function () {
      const projectId = Client.randomId()
      const userId = '0123456789abcdef01234567'
      const request = {
        rootResourcePath: 'main.tex',
        resources: [
          {
            path: 'main.tex',
            content: `\
\\documentclass{article}
\\begin{document}
Hello world
\\end{document}\
`,
          },
        ],
      }

      const { conversionId, buildId, file } =
        await Client.convertProjectToDocument(
          projectId,
          userId,
          'docx',
          request,
          'json'
        )

      expect(conversionId).to.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
      expect(buildId).to.match(/^[0-9a-f]+-[0-9a-f]+$/)

      const downloadUrl = new URL(Settings.apis.clsi.downloadHost)
      downloadUrl.pathname = `/project/${conversionId}/build/${buildId}/output/${file}`
      const { stream, response } = await fetchStreamWithResponse(
        downloadUrl.href
      )
      expect(response.status).to.equal(200)

      const body = await buffer(stream)
      expect(body.length).to.be.greaterThan(0)
      // .docx is a zip archive — verify the PK\x03\x04 magic bytes
      expect(body[0]).to.equal(0x50)
      expect(body[1]).to.equal(0x4b)
      expect(body[2]).to.equal(0x03)
      expect(body[3]).to.equal(0x04)
    })
  })
})
