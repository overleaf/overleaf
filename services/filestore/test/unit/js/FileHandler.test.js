import sinon from 'sinon'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ObjectId } from 'mongodb'
import OriginalSettings from '@overleaf/settings'

const modulePath = '../../../app/js/FileHandler.js'

describe('FileHandler', () => {
  let PersistorManager,
    LocalFileWriter,
    FileConverter,
    KeyBuilder,
    ImageOptimiser,
    FileHandler,
    Settings,
    fs

  const bucket = 'my_bucket'
  const key = `${new ObjectId()}/${new ObjectId()}`
  const convertedFolderKey = `${new ObjectId()}/${new ObjectId()}`
  const sourceStream = 'sourceStream'
  const convertedKey = 'convertedKey'
  const redirectUrl = 'https://wombat.potato/giraffe'
  const readStream = {
    stream: 'readStream',
    on: sinon.stub(),
  }

  beforeEach(async () => {
    PersistorManager = {
      getObjectStream: sinon.stub().resolves(sourceStream),
      getRedirectUrl: sinon.stub().resolves(redirectUrl),
      checkIfObjectExists: sinon.stub().resolves(),
      deleteObject: sinon.stub().resolves(),
      deleteDirectory: sinon.stub().resolves(),
      sendStream: sinon.stub().resolves(),
      insertFile: sinon.stub().resolves(),
      sendFile: sinon.stub().resolves(),
    }
    LocalFileWriter = {
      // the callback style is used for detached cleanup calls
      deleteFile: sinon.stub().yields(),
      promises: {
        writeStream: sinon.stub().resolves(),
        deleteFile: sinon.stub().resolves(),
      },
    }
    FileConverter = {
      promises: {
        convert: sinon.stub().resolves(),
        thumbnail: sinon.stub().resolves(),
        preview: sinon.stub().resolves(),
      },
    }
    KeyBuilder = {
      addCachingToKey: sinon.stub().returns(convertedKey),
      getConvertedFolderKey: sinon.stub().returns(convertedFolderKey),
    }
    ImageOptimiser = {
      promises: {
        compressPng: sinon.stub().resolves(),
      },
    }
    Settings = {
      ...OriginalSettings,
      filestore: {
        stores: {
          ...(OriginalSettings.filestore?.stores ?? {}),
          template_files: 'template_files',
        },
      },
    }
    fs = {
      createReadStream: sinon.stub().returns(readStream),
    }

    vi.doMock('../../../app/js/PersistorManager', () => ({
      default: PersistorManager,
    }))

    vi.doMock('../../../app/js/LocalFileWriter', () => ({
      default: LocalFileWriter,
    }))

    vi.doMock('../../../app/js/FileConverter', () => ({
      default: FileConverter,
    }))

    vi.doMock('../../../app/js/KeyBuilder', () => ({
      default: KeyBuilder,
    }))

    vi.doMock('../../../app/js/ImageOptimiser', () => ({
      default: ImageOptimiser,
    }))

    vi.doMock('@overleaf/settings', () => {
      return {
        default: Settings,
      }
    })

    vi.doMock('@overleaf/metrics', () => ({
      default: {
        gauge: sinon.stub(),
        Timer: sinon.stub().returns({ done: sinon.stub() }),
      },
    }))

    vi.doMock('node:fs', () => ({
      default: fs,
    }))

    FileHandler = (await import(modulePath)).default
    FileHandler._TESTONLYSwapPersistorManager(PersistorManager)
  })

  describe('insertFile', () => {
    const stream = 'stream'

    it('should send file to the filestore', async () => {
      await FileHandler.promises.insertFile(bucket, key, stream)
      expect(PersistorManager.sendStream).to.have.been.calledWith(
        bucket,
        key,
        stream
      )
    })

    it('should not make a delete request for the convertedKey folder', async () => {
      await FileHandler.promises.insertFile(bucket, key, stream)
      expect(PersistorManager.deleteDirectory).not.to.have.been.called
    })

    it('should accept templates-api key format', async () => {
      KeyBuilder.getConvertedFolderKey.returns(
        '5ecba29f1a294e007d0bccb4/v/0/pdf'
      )
      await FileHandler.promises.insertFile(bucket, key, stream)
    })

    it('should throw an error when the key is in the wrong format', async () => {
      KeyBuilder.getConvertedFolderKey.returns('wombat')
      expect(FileHandler.promises.insertFile(bucket, key, stream)).to.be
        .rejected
    })
  })

  describe('getFile', () => {
    it('should return the source stream no format or style are defined', async () => {
      const stream = await FileHandler.promises.getFile(bucket, key, null)
      expect(stream).to.equal(sourceStream)
    })

    it('should pass options through to PersistorManager', async () => {
      const options = { start: 0, end: 8 }
      await FileHandler.promises.getFile(bucket, key, options)
      expect(PersistorManager.getObjectStream).to.have.been.calledWith(
        bucket,
        key,
        options
      )
    })

    describe('when a format is defined', () => {
      let result

      describe('when the file is not cached', () => {
        beforeEach(async () => {
          const stream = await FileHandler.promises.getFile(bucket, key, {
            format: 'png',
          })
          result = { stream }
        })

        it('should convert the file', () => {
          expect(FileConverter.promises.convert).to.have.been.called
        })

        it('should compress the converted file', () => {
          expect(ImageOptimiser.promises.compressPng).to.have.been.called
        })

        it('should return the the converted stream', () => {
          expect(result.stream).to.equal(readStream)
          expect(PersistorManager.getObjectStream).to.have.been.calledWith(
            bucket,
            key
          )
        })
      })

      describe('when the file is cached', () => {
        beforeEach(async () => {
          PersistorManager.checkIfObjectExists = sinon.stub().resolves(true)
          const stream = await FileHandler.promises.getFile(bucket, key, {
            format: 'png',
          })
          result = { stream }
        })

        it('should not convert the file', () => {
          expect(FileConverter.promises.convert).not.to.have.been.called
        })

        it('should not compress the converted file again', () => {
          expect(ImageOptimiser.promises.compressPng).not.to.have.been.called
        })

        it('should return the cached stream', () => {
          expect(result.stream).to.equal(sourceStream)
          expect(PersistorManager.getObjectStream).to.have.been.calledWith(
            bucket,
            convertedKey
          )
        })
      })
    })

    describe('when a style is defined', () => {
      it('generates a thumbnail when requested', async () => {
        await FileHandler.promises.getFile(bucket, key, { style: 'thumbnail' })
        expect(FileConverter.promises.thumbnail).to.have.been.called
        expect(FileConverter.promises.preview).not.to.have.been.called
      })

      it('generates a preview when requested', async () => {
        await FileHandler.promises.getFile(bucket, key, { style: 'preview' })
        expect(FileConverter.promises.thumbnail).not.to.have.been.called
        expect(FileConverter.promises.preview).to.have.been.called
      })
    })
  })

  describe('getRedirectUrl', () => {
    beforeEach(() => {
      Settings.filestore = {
        ...OriginalSettings.filestore,
        allowRedirects: true,
        stores: {
          ...OriginalSettings.filestore.stores,
          userFiles: bucket,
        },
      }
    })

    it('should return a redirect url', async () => {
      const url = await FileHandler.promises.getRedirectUrl(bucket, key)
      expect(url).to.equal(redirectUrl)
    })

    it('should call the persistor to get a redirect url', async () => {
      await FileHandler.promises.getRedirectUrl(bucket, key)
      expect(PersistorManager.getRedirectUrl).to.have.been.calledWith(
        bucket,
        key
      )
    })

    it('should return null if options are supplied', async () => {
      const url = await FileHandler.promises.getRedirectUrl(bucket, key, {
        start: 100,
        end: 200,
      })
      expect(url).to.be.null
    })

    it('should return null if the bucket is not one of the defined ones', async () => {
      const url = await FileHandler.promises.getRedirectUrl(
        'a_different_bucket',
        key
      )
      expect(url).to.be.null
    })

    it('should return null if redirects are not enabled', async () => {
      Settings.filestore.allowRedirects = false

      const url = await FileHandler.promises.getRedirectUrl(bucket, key)
      expect(url).to.be.null
    })
  })
})
