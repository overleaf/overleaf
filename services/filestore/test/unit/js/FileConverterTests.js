const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const SandboxedModule = require('sandboxed-module')
const { Errors } = require('@overleaf/object-persistor')

const modulePath = '../../../app/js/FileConverter.js'

describe('FileConverter', function () {
  let SafeExec, FileConverter
  const sourcePath = '/data/wombat.eps'
  const destPath = '/tmp/dest.png'
  const format = 'png'
  const errorMessage = 'guru meditation error'
  const Settings = {
    commands: {
      convertCommandPrefix: [],
    },
  }

  beforeEach(function () {
    SafeExec = {
      promises: sinon.stub().resolves(destPath),
    }

    const ObjectPersistor = { Errors }

    FileConverter = SandboxedModule.require(modulePath, {
      requires: {
        './SafeExec': SafeExec,
        '@overleaf/metrics': {
          inc: sinon.stub(),
          Timer: sinon.stub().returns({ done: sinon.stub() }),
        },
        '@overleaf/settings': Settings,
        '@overleaf/object-persistor': ObjectPersistor,
      },
    })
  })

  describe('convert', function () {
    it('should convert the source to the requested format', async function () {
      await FileConverter.promises.convert(sourcePath, format)
      const args = SafeExec.promises.args[0][0]
      expect(args).to.include(`${sourcePath}[0]`)
      expect(args).to.include(`${sourcePath}.${format}`)
    })

    it('should return the dest path', async function () {
      const destPath = await FileConverter.promises.convert(sourcePath, format)
      destPath.should.equal(`${sourcePath}.${format}`)
    })

    it('should wrap the error from convert', async function () {
      SafeExec.promises.rejects(errorMessage)
      try {
        await FileConverter.promises.convert(sourcePath, format)
        expect('error should have been thrown').not.to.exist
      } catch (err) {
        expect(err.name).to.equal('ConversionError')
        expect(err.cause.toString()).to.equal(errorMessage)
      }
    })

    it('should not accept an non approved format', async function () {
      try {
        await FileConverter.promises.convert(sourcePath, 'potato')
        expect('error should have been thrown').not.to.exist
      } catch (err) {
        expect(err.name).to.equal('ConversionError')
      }
    })

    it('should prefix the command with Settings.commands.convertCommandPrefix', async function () {
      Settings.commands.convertCommandPrefix = ['nice']
      await FileConverter.promises.convert(sourcePath, format)
    })

    it('should convert the file when called as a callback', function (done) {
      FileConverter.convert(sourcePath, format, (err, destPath) => {
        expect(err).not.to.exist
        destPath.should.equal(`${sourcePath}.${format}`)

        const args = SafeExec.promises.args[0][0]
        expect(args).to.include(`${sourcePath}[0]`)
        expect(args).to.include(`${sourcePath}.${format}`)
        done()
      })
    })
  })

  describe('thumbnail', function () {
    it('should call converter resize with args', async function () {
      await FileConverter.promises.thumbnail(sourcePath)
      const args = SafeExec.promises.args[0][0]
      expect(args).to.include(`${sourcePath}[0]`)
    })
  })

  describe('preview', function () {
    it('should call converter resize with args', async function () {
      await FileConverter.promises.preview(sourcePath)
      const args = SafeExec.promises.args[0][0]
      expect(args).to.include(`${sourcePath}[0]`)
    })
  })
})
