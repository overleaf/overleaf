import Client from './helpers/Client.js'
import ClsiApp from './helpers/ClsiApp.js'
import Path from 'node:path'
import fs from 'node:fs'
import { pipeline } from 'node:stream/promises'
import yauzl from 'yauzl'
import { expect } from 'chai'

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
      const stream = await Client.convertDocx(sourcePath)
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

    it('should fail when file is not a docx', async function () {
      const sourcePath = Path.join(
        import.meta.dirname,
        '../fixtures/minimal.pdf'
      )
      await expect(Client.convertDocx(sourcePath)).to.eventually.be.rejected
    })
  })
})
