import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const modulePath = '../../../../app/src/infrastructure/Multer.mjs'
const MB = 1024 * 1024

describe('Multer', function () {
  let Multer
  let mockFs
  let mockMulter
  let mockMulterInstance
  let mockSettings
  let mockRandomUUID
  let mockLogger

  beforeEach(async function () {
    mockRandomUUID = vi.fn()

    mockFs = {
      unlink: vi.fn(),
    }

    mockLogger = {
      warn: vi.fn(),
    }

    const mockStorageInstance = { single: vi.fn() }
    mockMulterInstance = { single: vi.fn() }

    // Create a stub function for multer with diskStorage as a property
    mockMulter = vi.fn().mockReturnValue(mockMulterInstance)
    mockMulter.diskStorage = vi.fn().mockReturnValue(mockStorageInstance)

    mockSettings = {
      multerOptions: {
        limits: {
          fileSize: 100 * MB,
        },
      },
    }

    vi.doMock('node:fs', () => ({
      default: mockFs,
    }))

    vi.doMock('multer', () => ({
      default: mockMulter,
    }))

    vi.doMock('node:crypto', () => ({
      default: {
        randomUUID: mockRandomUUID,
      },
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: mockSettings,
    }))

    vi.doMock('@overleaf/logger', () => ({
      default: mockLogger,
    }))

    Multer = await import(modulePath)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  describe('multerUploadHandler options merging', function () {
    it('returns the full multer handler object', function () {
      const handler = Multer.multerUploadHandler()

      expect(mockMulter).toHaveBeenCalledOnce()
      expect(handler).toBe(mockMulterInstance)
    })

    it('uses Settings defaults when options are omitted', function () {
      Multer.multerUploadHandler()

      expect(mockMulter).toHaveBeenCalledOnce()
      const config = mockMulter.mock.calls[0][0]
      expect(config.limits.fileSize).toBe(
        mockSettings.multerOptions.limits.fileSize
      )
    })

    it('uses Settings defaults when options are empty', function () {
      Multer.multerUploadHandler({})

      expect(mockMulter).toHaveBeenCalledOnce()
      const config = mockMulter.mock.calls[0][0]
      expect(config.limits.fileSize).toBe(
        mockSettings.multerOptions.limits.fileSize
      )
    })

    it('preserves provided fileSize from options', function () {
      const customLimit = 25 * MB

      Multer.multerUploadHandler({
        limits: { fileSize: customLimit },
      })

      expect(mockMulter).toHaveBeenCalledOnce()
      const config = mockMulter.mock.calls[0][0]
      expect(config.limits.fileSize).toBe(customLimit)
    })
  })

  describe('diskStorage configuration', function () {
    it('creates diskStorage when dest option provided', function () {
      Multer.multerUploadHandler({
        dest: '/tmp/uploads',
      })

      expect(mockMulter.diskStorage).toHaveBeenCalledOnce()
    })

    it('diskStorage receives destination and filename callback', function () {
      Multer.multerUploadHandler({
        dest: '/tmp/uploads',
      })

      const config = mockMulter.diskStorage.mock.calls[0][0]
      expect(config.destination).toBeDefined()
      expect(config.filename).toBeDefined()
    })

    it('passes storage to multer instead of dest', function () {
      Multer.multerUploadHandler({
        dest: '/tmp/uploads',
      })

      expect(mockMulter).toHaveBeenCalledOnce()
      const config = mockMulter.mock.calls[0][0]
      expect(config.storage).toBeDefined()
      expect(config.dest).toBeUndefined()
    })
  })

  describe('filenameWithCleanup callback', function () {
    let filenameCallback
    let req
    let file

    beforeEach(function () {
      Multer.multerUploadHandler({
        dest: '/tmp/uploads',
      })

      const storageConfig = mockMulter.diskStorage.mock.calls[0][0]
      filenameCallback = storageConfig.filename

      req = {
        once: vi.fn(),
        complete: true,
      }
      file = {
        fieldname: 'qqfile',
        originalname: 'document.pdf',
      }

      mockRandomUUID.mockReturnValue('test-uuid-1234')
    })

    it('calls callback with null error and filename', function () {
      const cb = vi.fn()
      filenameCallback(req, file, cb)
      expect(cb).toHaveBeenCalledOnce()
      const [err, filename] = cb.mock.calls[0]
      expect(err).toBe(null)
      expect(filename).toBe('test-uuid-1234')
    })

    it('sets up request close listener for cleanup', function () {
      filenameCallback(req, file, vi.fn())
      expect(req.once).toHaveBeenCalledOnce()
      const [event] = req.once.mock.calls[0]
      expect(event).toBe('close')
    })

    describe('cleanup on request abort', function () {
      it('does not unlink if request completed successfully', function () {
        req.complete = true
        const cb = vi.fn()
        filenameCallback(req, file, cb)

        const closeHandler = req.once.mock.calls[0][1]
        closeHandler()

        expect(mockFs.unlink).not.toHaveBeenCalled()
      })

      it('unlinks file if request was aborted', function () {
        req.complete = false
        const cb = vi.fn()
        mockRandomUUID.mockReturnValue('aborted-file-uuid')

        filenameCallback(req, file, cb)

        const closeHandler = req.once.mock.calls[0][1]
        closeHandler()

        expect(mockFs.unlink).toHaveBeenCalledOnce()
        const [path] = mockFs.unlink.mock.calls[0]
        expect(path).toBe('/tmp/uploads/aborted-file-uuid')
        expect(mockRandomUUID).toHaveBeenCalledOnce()
      })
    })
  })

  describe('multerErrorHandler', function () {
    let req, res, next, err

    beforeEach(function () {
      req = {}
      res = {}
      next = vi.fn()
      err = new Error('some error')
    })

    it('calls next with the error when req.file is not set', function () {
      Multer.multerErrorHandler(err, req, res, next)

      expect(mockFs.unlink).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledWith(err)
    })

    it('calls next with the error when req.file has no path', function () {
      req.file = {}
      Multer.multerErrorHandler(err, req, res, next)

      expect(mockFs.unlink).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledWith(err)
    })

    it('calls next with the error when req.file.path is empty', function () {
      req.file = { path: '' }
      Multer.multerErrorHandler(err, req, res, next)

      expect(mockFs.unlink).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledWith(err)
    })

    it('unlinks req.file.path and calls next with the error', function () {
      req.file = { path: '/tmp/uploads/some-file' }
      mockFs.unlink.mockImplementation((path, cb) => cb(null))

      Multer.multerErrorHandler(err, req, res, next)

      expect(mockFs.unlink).toHaveBeenCalledOnce()
      expect(mockFs.unlink.mock.calls[0][0]).toBe('/tmp/uploads/some-file')
      expect(next).toHaveBeenCalledWith(err)
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('swallows ENOENT errors from unlink without logging', function () {
      req.file = { path: '/tmp/uploads/missing-file' }
      const enoentErr = Object.assign(new Error('not found'), {
        code: 'ENOENT',
      })
      mockFs.unlink.mockImplementation((path, cb) => cb(enoentErr))

      Multer.multerErrorHandler(err, req, res, next)

      expect(mockLogger.warn).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledWith(err)
    })

    it('logs a warning when unlink fails for a reason other than ENOENT', function () {
      req.file = { path: '/tmp/uploads/locked-file' }
      const unlinkErr = new Error('permission denied')
      mockFs.unlink.mockImplementation((path, cb) => cb(unlinkErr))

      Multer.multerErrorHandler(err, req, res, next)

      expect(mockLogger.warn).toHaveBeenCalledOnce()
      const [fields] = mockLogger.warn.mock.calls[0]
      expect(fields.err).toBe(unlinkErr)
      expect(fields.uploadPath).toBe('/tmp/uploads/locked-file')
      expect(next).toHaveBeenCalledWith(err)
    })
  })
})
