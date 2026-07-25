const crypto = require('node:crypto')
const os = require('node:os')
const { expect } = require('chai')
const fs = require('node:fs')
const fsPromises = require('node:fs/promises')
const Path = require('node:path')
const StreamPromises = require('node:stream/promises')
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../src/Errors')

const MODULE_PATH = '../../src/FSPersistor.js'

function createTree(base, tree) {
  fs.mkdirSync(base, { recursive: true })
  for (const [name, content] of Object.entries(tree)) {
    const fullPath = Path.join(base, name)
    if (Buffer.isBuffer(content) || typeof content === 'string') {
      fs.writeFileSync(fullPath, content)
    } else if (content && typeof content.symlink === 'string') {
      fs.symlinkSync(content.symlink, fullPath)
    } else {
      createTree(fullPath, content)
    }
  }
}

describe('FSPersistorTests', function () {
  const fileContents = {
    'info.txt': Buffer.from('This information is critical', {
      encoding: 'utf-8',
    }),
    'other.txt': Buffer.from('Some other content', {
      encoding: 'utf-8',
    }),
  }
  let tmpDir
  let location
  let notADirPath
  const files = {
    wombat: 'animals/wombat.tex',
    giraffe: 'animals/giraffe.tex',
    potato: 'vegetables/potato.tex',
  }

  beforeEach(function () {
    tmpDir = fs.mkdtempSync(Path.join(os.tmpdir(), 'fs-persistor-test-'))
    createTree(tmpDir, {
      uploads: {
        'info.txt': fileContents['info.txt'],
        'other.txt': fileContents['other.txt'],
      },
      'not-a-dir':
        'This regular file is meant to prevent using this path as a directory',
      directory: {
        subdirectory: {},
      },
    })
    notADirPath = Path.join(tmpDir, 'not-a-dir')
    location = Path.join(tmpDir, 'bucket')
  })

  afterEach(function () {
    fs.rmSync(tmpDir, { recursive: true })
  })

  const scenarios = [
    {
      description: 'default settings',
      settings: {},
      fsPath: key => Path.join(location, key.replaceAll('/', '_')),
    },
    {
      description: 'with useSubdirectories = true',
      settings: { useSubdirectories: true },
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

      describe('sendFile', function () {
        it('should copy the file', async function () {
          await persistor.sendFile(
            location,
            files.wombat,
            Path.join(tmpDir, 'uploads', 'info.txt')
          )
          const contents = await fsPromises.readFile(
            scenario.fsPath(files.wombat)
          )
          expect(contents.equals(fileContents['info.txt'])).to.be.true
        })

        it('should return an error if the file cannot be stored', async function () {
          await expect(
            persistor.sendFile(
              notADirPath,
              files.wombat,
              Path.join(tmpDir, 'uploads', 'info.txt')
            )
          ).to.be.rejectedWith(Errors.WriteError)
        })
      })

      describe('sendStream', function () {
        let stream

        describe("when the file doesn't exist", function () {
          beforeEach(function () {
            stream = fs.createReadStream(
              Path.join(tmpDir, 'uploads', 'info.txt')
            )
          })

          it('should write the stream to disk', async function () {
            await persistor.sendStream(location, files.wombat, stream)
            const contents = await fsPromises.readFile(
              scenario.fsPath(files.wombat)
            )
            expect(contents.equals(fileContents['info.txt'])).to.be.true
          })

          it('should delete the temporary file', async function () {
            await persistor.sendStream(location, files.wombat, stream)
            const entries = await fsPromises.readdir(location)
            const tempDirs = entries.filter(dir => dir.startsWith('tmp-'))
            expect(tempDirs).to.be.empty
          })

          describe('on error', function () {
            beforeEach(async function () {
              await expect(
                persistor.sendStream(notADirPath, files.wombat, stream)
              ).to.be.rejectedWith(Errors.WriteError)
            })

            it('should not write the target file', async function () {
              await expect(fsPromises.access(scenario.fsPath(files.wombat))).to
                .be.rejected
            })

            it('should delete the temporary file', async function () {
              await persistor.sendStream(location, files.wombat, stream)
              const entries = await fsPromises.readdir(location)
              const tempDirs = entries.filter(dir => dir.startsWith('tmp-'))
              expect(tempDirs).to.be.empty
            })
          })

          describe('when the md5 hash matches', function () {
            it('should write the stream to disk', async function () {
              await persistor.sendStream(location, files.wombat, stream, {
                sourceMd5: md5(fileContents['info.txt']),
              })
              const contents = await fsPromises.readFile(
                scenario.fsPath(files.wombat)
              )
              expect(contents.equals(fileContents['info.txt'])).to.be.true
            })
          })

          describe('when the md5 hash does not match', function () {
            beforeEach(async function () {
              await expect(
                persistor.sendStream(location, files.wombat, stream, {
                  sourceMd5: md5('wrong content'),
                })
              ).to.be.rejectedWith(Errors.WriteError)
            })

            it('should not write the target file', async function () {
              await expect(fsPromises.access(scenario.fsPath(files.wombat))).to
                .be.rejected
            })

            it('should delete the temporary file', async function () {
              await persistor.sendStream(location, files.wombat, stream)
              const entries = await fsPromises.readdir(location)
              const tempDirs = entries.filter(dir => dir.startsWith('tmp-'))
              expect(tempDirs).to.be.empty
            })
          })
        })

        describe('when the file already exists', function () {
          let stream

          beforeEach(async function () {
            await persistor.sendFile(
              location,
              files.wombat,
              Path.join(tmpDir, 'uploads', 'info.txt')
            )
            stream = fs.createReadStream(
              Path.join(tmpDir, 'uploads', 'other.txt')
            )
          })

          it('should write the stream to disk', async function () {
            await persistor.sendStream(location, files.wombat, stream)
            const contents = await fsPromises.readFile(
              scenario.fsPath(files.wombat)
            )
            expect(contents.equals(fileContents['other.txt'])).to.be.true
          })

          it('should delete the temporary file', async function () {
            await persistor.sendStream(location, files.wombat, stream)
            const entries = await fsPromises.readdir(location)
            const tempDirs = entries.filter(dir => dir.startsWith('tmp-'))
            expect(tempDirs).to.be.empty
          })

          describe('on error', function () {
            beforeEach(async function () {
              await expect(
                persistor.sendStream(notADirPath, files.wombat, stream)
              ).to.be.rejectedWith(Errors.WriteError)
            })

            it('should not update the target file', async function () {
              const contents = await fsPromises.readFile(
                scenario.fsPath(files.wombat)
              )
              expect(contents.equals(fileContents['info.txt'])).to.be.true
            })

            it('should delete the temporary file', async function () {
              await persistor.sendStream(location, files.wombat, stream)
              const entries = await fsPromises.readdir(location)
              const tempDirs = entries.filter(dir => dir.startsWith('tmp-'))
              expect(tempDirs).to.be.empty
            })
          })

          describe('when the md5 hash matches', function () {
            it('should write the stream to disk', async function () {
              await persistor.sendStream(location, files.wombat, stream, {
                sourceMd5: md5(fileContents['other.txt']),
              })
              const contents = await fsPromises.readFile(
                scenario.fsPath(files.wombat)
              )
              expect(contents.equals(fileContents['other.txt'])).to.be.true
            })
          })

          describe('when the md5 hash does not match', function () {
            beforeEach(async function () {
              await expect(
                persistor.sendStream(location, files.wombat, stream, {
                  sourceMd5: md5('wrong content'),
                })
              ).to.be.rejectedWith(Errors.WriteError)
            })

            it('should not update the target file', async function () {
              const contents = await fsPromises.readFile(
                scenario.fsPath(files.wombat)
              )
              expect(contents.equals(fileContents['info.txt'])).to.be.true
            })

            it('should delete the temporary file', async function () {
              await persistor.sendStream(location, files.wombat, stream)
              const entries = await fsPromises.readdir(location)
              const tempDirs = entries.filter(dir => dir.startsWith('tmp-'))
              expect(tempDirs).to.be.empty
            })
          })
        })
      })

      describe('getObjectStream', function () {
        beforeEach(async function () {
          await persistor.sendFile(
            location,
            files.wombat,
            Path.join(tmpDir, 'uploads', 'info.txt')
          )
        })

        it('should return a string with the object contents', async function () {
          const stream = await persistor.getObjectStream(location, files.wombat)
          const contents = await streamToBuffer(stream)
          expect(contents.equals(fileContents['info.txt'])).to.be.true
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
          expect(contents.equals(fileContents['info.txt'].slice(5, 17))).to.be
            .true
        })

        it('should give a NotFoundError if the file does not exist', async function () {
          await expect(
            persistor.getObjectStream(location, 'does-not-exist')
          ).to.be.rejectedWith(Errors.NotFoundError)
        })
      })

      describe('getObjectSize', function () {
        beforeEach(async function () {
          await persistor.sendFile(
            location,
            files.wombat,
            Path.join(tmpDir, 'uploads', 'info.txt')
          )
        })

        it('should return the file size', async function () {
          expect(
            await persistor.getObjectSize(location, files.wombat)
          ).to.equal(fileContents['info.txt'].length)
        })

        it('should throw a NotFoundError if the file does not exist', async function () {
          await expect(
            persistor.getObjectSize(location, 'does-not-exist')
          ).to.be.rejectedWith(Errors.NotFoundError)
        })
      })

      describe('copyObject', function () {
        beforeEach(async function () {
          await persistor.sendFile(
            location,
            files.wombat,
            Path.join(tmpDir, 'uploads', 'info.txt')
          )
        })

        it('Should copy the file to the new location', async function () {
          await persistor.copyObject(location, files.wombat, files.potato)
          const contents = await fsPromises.readFile(
            scenario.fsPath(files.potato)
          )
          expect(contents.equals(fileContents['info.txt'])).to.be.true
        })
      })

      describe('deleteObject', function () {
        beforeEach(async function () {
          await persistor.sendFile(
            location,
            files.wombat,
            Path.join(tmpDir, 'uploads', 'info.txt')
          )
          await fsPromises.access(scenario.fsPath(files.wombat))
        })

        it('should delete the file', async function () {
          await persistor.deleteObject(location, files.wombat)
          await expect(fsPromises.access(scenario.fsPath(files.wombat))).to.be
            .rejected
        })

        it("should ignore files that don't exist", async function () {
          await persistor.deleteObject(location, 'does-not-exist')
        })
      })

      describe('deleteDirectory', function () {
        beforeEach(async function () {
          for (const file of Object.values(files)) {
            await persistor.sendFile(
              location,
              file,
              Path.join(tmpDir, 'uploads', 'info.txt')
            )
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
          await persistor.sendFile(
            location,
            files.wombat,
            Path.join(tmpDir, 'uploads', 'info.txt')
          )
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
            await persistor.sendFile(
              location,
              file,
              Path.join(tmpDir, 'uploads', 'info.txt')
            )
          }
        })

        it('should sum directory files size', async function () {
          expect(await persistor.directorySize(location, 'animals')).to.equal(
            2 * fileContents['info.txt'].length
          )
        })

        it('should return 0 on non-existing directories', async function () {
          expect(
            await persistor.directorySize(location, 'does-not-exist')
          ).to.equal(0)
        })
      })

      describe('listDirectoryKeys', function () {
        beforeEach(async function () {
          for (const file of Object.values(files)) {
            await persistor.sendFile(
              location,
              file,
              Path.join(tmpDir, 'uploads', 'info.txt')
            )
          }
        })

        it('should list directory keys', async function () {
          const keys = await persistor.listDirectoryKeys(location, 'animals')
          expect(keys).to.have.lengthOf(2)
          expect(keys).to.include(scenario.fsPath(files.wombat))
          expect(keys).to.include(scenario.fsPath(files.giraffe))
        })

        it('should return empty array for non-existing directories', async function () {
          const keys = await persistor.listDirectoryKeys(
            location,
            'does-not-exist'
          )
          expect(keys).to.deep.equal([])
        })
      })

      describe('listDirectoryStats', function () {
        beforeEach(async function () {
          for (const file of Object.values(files)) {
            await persistor.sendFile(
              location,
              file,
              Path.join(tmpDir, 'uploads', 'info.txt')
            )
          }
        })

        it('should list directory stats', async function () {
          const stats = await persistor.listDirectoryStats(location, 'animals')
          expect(stats).to.have.lengthOf(2)
          const keys = stats.map(s => s.key)
          expect(keys).to.include(scenario.fsPath(files.wombat))
          expect(keys).to.include(scenario.fsPath(files.giraffe))
          for (const stat of stats) {
            expect(stat.size).to.equal(fileContents['info.txt'].length)
          }
        })

        it('should return empty array for non-existing directories', async function () {
          const stats = await persistor.listDirectoryStats(
            location,
            'does-not-exist'
          )
          expect(stats).to.deep.equal([])
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
