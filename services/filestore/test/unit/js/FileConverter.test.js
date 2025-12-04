import sinon from 'sinon'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import _ObjectPersistor, { Errors } from '@overleaf/object-persistor'

const modulePath = '../../../app/js/FileConverter.js'

describe('FileConverter', () => {
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

  beforeEach(async () => {
    SafeExec = {
      promises: sinon.stub().resolves(destPath),
    }

    const ObjectPersistor = { Errors }

    vi.doMock('../../../app/js/SafeExec', () => ({
      default: SafeExec,
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: {
        inc: sinon.stub(),
        Timer: sinon.stub().returns({ done: sinon.stub() }),
      },
    }))

    vi.doMock('@overleaf/settings', async importOriginal => {
      const originalModule = (await importOriginal()).default
      return {
        default: { ...originalModule, ...Settings },
      }
    })

    vi.doMock('@overleaf/object-persistor', () => ({
      ...ObjectPersistor,
      default: _ObjectPersistor,
    }))

    FileConverter = (await import(modulePath)).default
  })

  describe('convert', () => {
    it('should convert the source to the requested format', async () => {
      await FileConverter.promises.convert(sourcePath, format)
      const args = SafeExec.promises.args[0][0]
      expect(args).to.include(`${sourcePath}[0]`)
      expect(args).to.include(`${sourcePath}.${format}`)
    })

    it('should return the dest path', async () => {
      const destPath = await FileConverter.promises.convert(sourcePath, format)
      expect(destPath).to.equal(`${sourcePath}.${format}`)
    })

    it('should wrap the error from convert', async () => {
      SafeExec.promises.rejects(errorMessage)
      try {
        await FileConverter.promises.convert(sourcePath, format)
        expect('error should have been thrown').not.to.exist
      } catch (err) {
        expect(err.name).to.equal('ConversionError')
        expect(err.cause.toString()).to.equal(errorMessage)
      }
    })

    it('should not accept an non approved format', async () => {
      try {
        await FileConverter.promises.convert(sourcePath, 'potato')
        expect('error should have been thrown').not.to.exist
      } catch (err) {
        expect(err.name).to.equal('ConversionError')
      }
    })

    it('should prefix the command with Settings.commands.convertCommandPrefix', async () => {
      Settings.commands.convertCommandPrefix = ['nice']
      await FileConverter.promises.convert(sourcePath, format)
    })

    it('should convert the file when called as a callback', async () => {
      const destPath = await FileConverter.promises.convert(sourcePath, format)

      expect(destPath).to.equal(`${sourcePath}.${format}`)

      const args = SafeExec.promises.args[0][0]
      expect(args).to.include(`${sourcePath}[0]`)
      expect(args).to.include(`${sourcePath}.${format}`)
    })
  })

  describe('thumbnail', () => {
    it('should call converter resize with args', async () => {
      await FileConverter.promises.thumbnail(sourcePath)
      const args = SafeExec.promises.args[0][0]
      expect(args).to.include(`${sourcePath}[0]`)
    })
  })

  describe('preview', () => {
    it('should call converter resize with args', async () => {
      await FileConverter.promises.preview(sourcePath)
      const args = SafeExec.promises.args[0][0]
      expect(args).to.include(`${sourcePath}[0]`)
    })
  })
})
