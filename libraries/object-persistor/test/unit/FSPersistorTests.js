const crypto = require('crypto')
const { expect } = require('chai')
const mockFs = require('mock-fs')
const fs = require('fs')
const fsPromises = require('fs/promises')
const Path = require('path')
const StreamPromises = require('stream/promises')
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../src/Errors')

const MODULE_PATH = '../../src/FSPersistor.js'

describe('FSPersistorTests', function () {
  const localFilePath = '/uploads/info.txt'
  const localFileContents = Buffer.from('This information is critical', {
    encoding: 'utf-8',
  })
  const uploadFolder = '/tmp'
  const location = '/bucket'
  const files = {
    wombat: 'animals/wombat.tex',
    giraffe: 'animals/giraffe.tex',
    potato: 'vegetables/potato.tex',
  }

  const scenarios = [
    {
      description: 'default settings',
      settings: { paths: { uploadFolder } },
      fsPath: key => Path.join(location, key.replaceAll('/', '_')),
    },
    {
      description: 'with useSubdirectories = true',
      settings: { paths: { uploadFolder }, useSubdirectories: true },
      fsPath: key => Path.join(location, key),
    },
  ]

  for (const scenario of scenarios) {
    describe(scenario.description, function () {
      let persistor

      beforeEach(function () {
        const FSPersistor = SandboxedModule.require(MODULE_PATH, {
          requires: {
            'fs/promises': fsPromises,
            'stream/promises': StreamPromises,
            './Errors': Errors,
          },
        })
        persistor = new FSPersistor(scenario.settings)
      })

      beforeEach(function () {
        mockFs({
          [localFilePath]: localFileContents,
          [location]: {},
          '/not-a-dir':
            'This regular file is meant to prevent using this path as a directory',
          '/directory/subdirectory': {},
        })
      })

      afterEach(function () {
        mockFs.restore()
      })

      describe('sendFile', function () {
        it('should copy the file', async function () {
          await persistor.sendFile(location, files.wombat, localFilePath)
          const contents = await fsPromises.readFile(
            scenario.fsPath(files.wombat)
          )
          expect(contents.equals(localFileContents)).to.be.true
        })

        it('should return an error if the file cannot be stored', async function () {
          await expect(
            persistor.sendFile('/not-a-dir', files.wombat, localFilePath)
          ).to.be.rejectedWith(Errors.WriteError)
        })
      })

      describe('sendStream', function () {
        let stream

        beforeEach(function () {
          stream = fs.createReadStream(localFilePath)
        })

        it('should write the stream to disk', async function () {
          await persistor.sendStream(location, files.wombat, stream)
          const contents = await fsPromises.readFile(
            scenario.fsPath(files.wombat)
          )
          expect(contents.equals(localFileContents)).to.be.true
        })

        it('should delete the temporary file', async function () {
          await persistor.sendStream(location, files.wombat, stream)
          const tempFiles = await fsPromises.readdir(uploadFolder)
          expect(tempFiles).to.be.empty
        })

        it('should wrap the error from the filesystem', async function () {
          await expect(
            persistor.sendStream('/not-a-dir', files.wombat, stream)
          ).to.be.rejectedWith(Errors.WriteError)
        })

        describe('when the md5 hash matches', function () {
          it('should write the stream to disk', async function () {
            await persistor.sendStream(location, files.wombat, stream, {
              sourceMd5: md5(localFileContents),
            })
            const contents = await fsPromises.readFile(
              scenario.fsPath(files.wombat)
            )
            expect(contents.equals(localFileContents)).to.be.true
          })
        })

        describe('when the md5 hash does not match', function () {
          let promise

          beforeEach(function () {
            promise = persistor.sendStream(location, files.wombat, stream, {
              sourceMd5: md5('wrong content'),
            })
          })

          it('should return a write error', async function () {
            await expect(promise).to.be.rejectedWith(
              Errors.WriteError,
              'md5 hash mismatch'
            )
          })

          it('deletes the copied file', async function () {
            await expect(promise).to.be.rejected
            await expect(
              fsPromises.access(scenario.fsPath(files.wombat))
            ).to.be.rejected
          })
        })
      })

      describe('getObjectStream', function () {
        beforeEach(async function () {
          await persistor.sendFile(location, files.wombat, localFilePath)
        })

        it('should return a string with the object contents', async function () {
          const stream = await persistor.getObjectStream(location, files.wombat)
          const contents = await streamToBuffer(stream)
          expect(contents.equals(localFileContents)).to.be.true
        })

        it('should support ranges', async function () {
          const stream = await persistor.getObjectStream(
            location,
            files.wombat,
            {
              start: 5,
              end: 16,
            }
          )
          const contents = await streamToBuffer(stream)
          // end is inclusive in ranges, but exclusive in slice()
          expect(contents.equals(localFileContents.slice(5, 17))).to.be.true
        })

        it('should give a NotFoundError if the file does not exist', async function () {
          await expect(
            persistor.getObjectStream(location, 'does-not-exist')
          ).to.be.rejectedWith(Errors.NotFoundError)
        })
      })

      describe('getObjectSize', function () {
        beforeEach(async function () {
          await persistor.sendFile(location, files.wombat, localFilePath)
        })

        it('should return the file size', async function () {
          expect(
            await persistor.getObjectSize(location, files.wombat)
          ).to.equal(localFileContents.length)
        })

        it('should throw a NotFoundError if the file does not exist', async function () {
          await expect(
            persistor.getObjectSize(location, 'does-not-exist')
          ).to.be.rejectedWith(Errors.NotFoundError)
        })
      })

      describe('copyObject', function () {
        beforeEach(async function () {
          await persistor.sendFile(location, files.wombat, localFilePath)
        })

        it('Should copy the file to the new location', async function () {
          await persistor.copyObject(location, files.wombat, files.potato)
          const contents = await fsPromises.readFile(
            scenario.fsPath(files.potato)
          )
          expect(contents.equals(localFileContents)).to.be.true
        })
      })

      describe('deleteObject', function () {
        beforeEach(async function () {
          await persistor.sendFile(location, files.wombat, localFilePath)
          await fsPromises.access(scenario.fsPath(files.wombat))
        })

        it('should delete the file', async function () {
          await persistor.deleteObject(location, files.wombat)
          await expect(
            fsPromises.access(scenario.fsPath(files.wombat))
          ).to.be.rejected
        })

        it("should ignore files that don't exist", async function () {
          await persistor.deleteObject(location, 'does-not-exist')
        })
      })

      describe('deleteDirectory', function () {
        beforeEach(async function () {
          for (const file of Object.values(files)) {
            await persistor.sendFile(location, file, localFilePath)
            await fsPromises.access(scenario.fsPath(file))
          }
        })

        it('should delete all files under the directory', async function () {
          await persistor.deleteDirectory(location, 'animals')
          for (const file of [files.wombat, files.giraffe]) {
            await expect(fsPromises.access(scenario.fsPath(file))).to.be
              .rejected
          }
        })

        it('should not delete files under other directoris', async function () {
          await persistor.deleteDirectory(location, 'animals')
          await fsPromises.access(scenario.fsPath(files.potato))
        })

        it("should ignore directories that don't exist", async function () {
          await persistor.deleteDirectory(location, 'does-not-exist')
          for (const file of Object.values(files)) {
            await fsPromises.access(scenario.fsPath(file))
          }
        })
      })

      describe('checkIfObjectExists', function () {
        beforeEach(async function () {
          await persistor.sendFile(location, files.wombat, localFilePath)
        })

        it('should return true for existing files', async function () {
          expect(
            await persistor.checkIfObjectExists(location, files.wombat)
          ).to.equal(true)
        })

        it('should return false for non-existing files', async function () {
          expect(
            await persistor.checkIfObjectExists(location, 'does-not-exist')
          ).to.equal(false)
        })
      })

      describe('directorySize', function () {
        beforeEach(async function () {
          for (const file of Object.values(files)) {
            await persistor.sendFile(location, file, localFilePath)
          }
        })

        it('should sum directory files size', async function () {
          expect(await persistor.directorySize(location, 'animals')).to.equal(
            2 * localFileContents.length
          )
        })

        it('should return 0 on non-existing directories', async function () {
          expect(
            await persistor.directorySize(location, 'does-not-exist')
          ).to.equal(0)
        })
      })
    })
  }
})

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex')
}

async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
