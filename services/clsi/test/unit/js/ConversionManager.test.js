import Path from 'node:path'
import sinon from 'sinon'
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest'
const MODULE_PATH = Path.join(
  import.meta.dirname,
  '../../../app/js/ConversionManager'
)

const CONVERT_TO_LATEX_CASES = [
  {
    type: 'docx',
    inputFilename: 'input.docx',
    pandocArgs: [
      'pandoc',
      'input.docx',
      '--output',
      'main.tex',
      '--to',
      'latex',
      '--standalone',
      '--extract-media=.',
      '--from',
      'docx+citations',
      '--citeproc',
    ],
  },
  {
    type: 'markdown',
    inputFilename: 'input.md',
    pandocArgs: [
      'pandoc',
      'input.md',
      '--output',
      'main.tex',
      '--to',
      'latex',
      '--standalone',
      '--from',
      'markdown',
    ],
  },
]

const LATEX_TO_DOCUMENT_CASES = [
  {
    type: 'docx',
    extension: 'docx',
    compressOutput: false,
    pandocArgs: outputId => [
      'pandoc',
      'main.tex',
      '--output',
      `${outputId}.docx`,
      '--from',
      'latex',
      '--to',
      'docx',
      '--citeproc',
      '--number-sections',
      '--resource-path=.',
    ],
  },
  {
    type: 'markdown',
    extension: 'md',
    compressOutput: true,
    pandocArgs: outputId => [
      'pandoc',
      Path.join('..', 'main.tex'),
      '--output',
      'main.md',
      '--from',
      'latex',
      '--to',
      'markdown',
      '--resource-path=..',
      '--extract-media=.',
    ],
  },
  {
    type: 'html',
    extension: 'html',
    compressOutput: true,
    pandocArgs: outputId => [
      'pandoc',
      Path.join('..', 'main.tex'),
      '--output',
      'main.html',
      '--from',
      'latex',
      '--to',
      'html',
      '--standalone',
      '--mathml',
      '--resource-path=..',
      '--extract-media=.',
    ],
  },
]

describe('ConversionManager', function () {
  beforeEach(async function (ctx) {
    ctx.CommandRunner = {
      promises: {
        run: sinon.stub().resolves({ stdout: '', stderr: '', exitCode: 0 }),
      },
    }

    ctx.lock = {
      release: sinon.stub(),
    }

    ctx.LockManager = {
      acquire: sinon.stub().returns(ctx.lock),
    }

    ctx.Settings = {
      pandocImage: 'mock-pandoc-image',
      conversionTimeoutSeconds: 60,
      path: { compilesDir: '/compiles' },
    }

    ctx.fs = {
      mkdir: sinon.stub().resolves(),
      copyFile: sinon.stub().resolves(),
      rm: sinon.stub().resolves(),
      unlink: sinon.stub().resolves(),
    }

    ctx.conversionId = 'test-conversion-id'
    ctx.conversionDir = '/compiles/test-conversion-id'
    ctx.outputPath = '/compiles/test-conversion-id/output-uuid.zip'

    ctx.uuidStub = sinon
      .stub(globalThis.crypto, 'randomUUID')
      .returns('output-uuid')

    vi.doMock('../../../app/js/LockManager', () => ({
      default: ctx.LockManager,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock('../../../app/js/CommandRunner', () => ({
      default: ctx.CommandRunner,
    }))

    vi.doMock('node:fs/promises', () => ({ default: ctx.fs }))

    ctx.ConversionManager = (await import(MODULE_PATH)).default
  })

  afterEach(function (ctx) {
    ctx.uuidStub.restore()
  })

  describe('convertToLaTeXWithLock', function () {
    describe('per conversion type', function () {
      CONVERT_TO_LATEX_CASES.forEach(({ type, inputFilename, pandocArgs }) => {
        describe(`type=${type}`, function () {
          beforeEach(async function (ctx) {
            ctx.inputPath = `/path/to/${inputFilename}`
            await ctx.ConversionManager.promises.convertToLaTeXWithLock(
              ctx.conversionId,
              ctx.inputPath,
              type
            )
          })

          it('should copy the input file to the conversion directory under the type-specific filename', function (ctx) {
            sinon.assert.calledWith(
              ctx.fs.copyFile,
              ctx.inputPath,
              Path.join(ctx.conversionDir, inputFilename)
            )
          })

          it('should run pandoc with the type-specific args', function (ctx) {
            expect(ctx.CommandRunner.promises.run.firstCall.args[1]).toEqual(
              pandocArgs
            )
          })
        })
      })
    })

    describe('with conversionType=docx (representative)', function () {
      beforeEach(function (ctx) {
        ctx.inputPath = '/path/to/input.docx'
      })

      describe('successful conversion', function () {
        beforeEach(async function (ctx) {
          ctx.result =
            await ctx.ConversionManager.promises.convertToLaTeXWithLock(
              ctx.conversionId,
              ctx.inputPath,
              'docx'
            )
        })

        it('should acquire a lock on the conversion directory', function (ctx) {
          sinon.assert.calledWith(ctx.LockManager.acquire, ctx.conversionDir)
        })

        it('should create the conversion directory', function (ctx) {
          sinon.assert.calledWith(ctx.fs.mkdir, ctx.conversionDir, {
            recursive: true,
          })
        })

        it('should run pandoc then zip with the conversion timeout in milliseconds', function (ctx) {
          expect(ctx.CommandRunner.promises.run.callCount).toBe(2)
          expect(ctx.CommandRunner.promises.run.secondCall.args[1]).toEqual([
            'zip',
            '-r',
            'output-uuid.zip',
            '.',
          ])
          expect(ctx.CommandRunner.promises.run.firstCall.args[4]).toBe(60_000)
          expect(ctx.CommandRunner.promises.run.secondCall.args[4]).toBe(60_000)
        })

        it('should remove the source document after conversion', function (ctx) {
          sinon.assert.calledWith(
            ctx.fs.unlink,
            Path.join(ctx.conversionDir, 'input.docx')
          )
        })

        it('should return the output zip path', function (ctx) {
          expect(ctx.result).toBe(ctx.outputPath)
        })

        it('should release the lock', function (ctx) {
          sinon.assert.called(ctx.lock.release)
        })
      })

      describe('unsuccessful conversion (pandoc exit code)', function () {
        beforeEach(async function (ctx) {
          ctx.CommandRunner.promises.run.resolves({
            stdout: '',
            stderr: '',
            exitCode: 63,
          })
          await expect(
            ctx.ConversionManager.promises.convertToLaTeXWithLock(
              ctx.conversionId,
              ctx.inputPath,
              'docx'
            )
          ).to.be.rejectedWith('Non-zero exit code from pandoc')
        })

        it('should remove the entire conversion directory', function (ctx) {
          sinon.assert.calledWith(ctx.fs.rm, ctx.conversionDir, {
            force: true,
            recursive: true,
          })
        })

        it('should release the lock', function (ctx) {
          sinon.assert.called(ctx.lock.release)
        })
      })

      describe('unsuccessful compression (zip exit code)', function () {
        beforeEach(async function (ctx) {
          ctx.CommandRunner.promises.run
            .onFirstCall()
            .resolves({ stdout: '', stderr: '', exitCode: 0 })
            .onSecondCall()
            .resolves({ stdout: '', stderr: '', exitCode: 12 })
          await expect(
            ctx.ConversionManager.promises.convertToLaTeXWithLock(
              ctx.conversionId,
              ctx.inputPath,
              'docx'
            )
          ).to.be.rejectedWith('pandoc conversion failed')
        })

        it('should remove the entire conversion directory', function (ctx) {
          sinon.assert.calledWith(ctx.fs.rm, ctx.conversionDir, {
            force: true,
            recursive: true,
          })
        })

        it('should release the lock', function (ctx) {
          sinon.assert.called(ctx.lock.release)
        })
      })

      describe('unsuccessful conversion (throws)', function () {
        beforeEach(async function (ctx) {
          ctx.CommandRunner.promises.run.rejects(
            new Error('mock conversion error')
          )
          await expect(
            ctx.ConversionManager.promises.convertToLaTeXWithLock(
              ctx.conversionId,
              ctx.inputPath,
              'docx'
            )
          ).to.be.rejectedWith('pandoc conversion failed')
        })

        it('should remove the entire conversion directory', function (ctx) {
          sinon.assert.calledWith(ctx.fs.rm, ctx.conversionDir, {
            force: true,
            recursive: true,
          })
        })

        it('should release the lock', function (ctx) {
          sinon.assert.called(ctx.lock.release)
        })
      })
    })

    describe('with an unsupported conversion type', function () {
      it('should reject with an unsupported conversion type error', async function (ctx) {
        await expect(
          ctx.ConversionManager.promises.convertToLaTeXWithLock(
            ctx.conversionId,
            '/path/to/input.txt',
            'not-a-real-type'
          )
        ).to.be.rejectedWith('unsupported conversion type')
      })
    })
  })

  describe('convertLaTeXToDocumentInDirWithLock', function () {
    beforeEach(function (ctx) {
      ctx.compileDir = '/compiles/test-compile-dir'
      ctx.rootDocPath = 'main.tex'
    })

    describe('pandoc args per conversion type', function () {
      LATEX_TO_DOCUMENT_CASES.forEach(({ type, pandocArgs }) => {
        it(`should run pandoc with the type-specific args for type=${type}`, async function (ctx) {
          await ctx.ConversionManager.promises.convertLaTeXToDocumentInDirWithLock(
            ctx.conversionId,
            ctx.compileDir,
            ctx.rootDocPath,
            type
          )
          expect(ctx.CommandRunner.promises.run.firstCall.args[1]).toEqual(
            pandocArgs('output-uuid')
          )
        })
      })
    })

    describe('with type=docx (representative non-compressing type)', function () {
      describe('successful conversion', function () {
        beforeEach(async function (ctx) {
          ctx.result =
            await ctx.ConversionManager.promises.convertLaTeXToDocumentInDirWithLock(
              ctx.conversionId,
              ctx.compileDir,
              ctx.rootDocPath,
              'docx'
            )
        })

        it('should acquire a lock on the compile dir', function (ctx) {
          sinon.assert.calledWith(ctx.LockManager.acquire, ctx.compileDir)
        })

        it('should release the lock', function (ctx) {
          sinon.assert.called(ctx.lock.release)
        })

        it('should pass the conversion timeout in milliseconds', function (ctx) {
          expect(ctx.CommandRunner.promises.run.firstCall.args[4]).toBe(60_000)
        })

        it('should not create a subdirectory or run zip and should return the document path directly', function (ctx) {
          sinon.assert.notCalled(ctx.fs.mkdir)
          expect(ctx.CommandRunner.promises.run.callCount).toBe(1)
          expect(ctx.result).toBe(Path.join(ctx.compileDir, 'output-uuid.docx'))
        })
      })

      describe('when pandoc fails (non-zero exit code)', function () {
        it('should reject with an error and release the lock', async function (ctx) {
          ctx.CommandRunner.promises.run.resolves({
            stdout: '',
            stderr: '',
            exitCode: 1,
          })
          await expect(
            ctx.ConversionManager.promises.convertLaTeXToDocumentInDirWithLock(
              ctx.conversionId,
              ctx.compileDir,
              ctx.rootDocPath,
              'docx'
            )
          ).to.be.rejectedWith('pandoc latex-to-document conversion failed')
          sinon.assert.called(ctx.lock.release)
        })
      })
    })

    describe('with type=markdown (representative compressing type)', function () {
      describe('successful conversion', function () {
        beforeEach(async function (ctx) {
          ctx.result =
            await ctx.ConversionManager.promises.convertLaTeXToDocumentInDirWithLock(
              ctx.conversionId,
              ctx.compileDir,
              ctx.rootDocPath,
              'markdown'
            )
        })

        it('should create a UUID-named subdirectory for the output', function (ctx) {
          sinon.assert.calledWith(
            ctx.fs.mkdir,
            Path.join(ctx.compileDir, 'output-uuid'),
            { recursive: true }
          )
        })

        it('should run the conversion in the uuid-named subdirectory', function (ctx) {
          expect(ctx.CommandRunner.promises.run.firstCall.args[7]).toBe(
            'output-uuid'
          )
        })

        it('should run the conversion and set the TEXINPUTS environment variable', function (ctx) {
          expect(
            ctx.CommandRunner.promises.run.firstCall.args[5]
          ).toMatchObject({ TEXINPUTS: '..:' })
        })

        it('should run pandoc then zip the subdirectory and return the zip path', function (ctx) {
          expect(ctx.CommandRunner.promises.run.callCount).toBe(2)
          expect(ctx.CommandRunner.promises.run.secondCall.args[1]).toEqual([
            'zip',
            '-r',
            Path.join('..', 'output-uuid.zip'),
            '.',
          ])
          expect(ctx.CommandRunner.promises.run.secondCall.args[7]).toBe(
            'output-uuid'
          )
          expect(ctx.result).toBe(Path.join(ctx.compileDir, 'output-uuid.zip'))
        })
      })

      describe('when zip fails (non-zero exit code)', function () {
        it('should reject with an error and release the lock', async function (ctx) {
          ctx.CommandRunner.promises.run
            .onFirstCall()
            .resolves({ stdout: '', stderr: '', exitCode: 0 })
            .onSecondCall()
            .resolves({ stdout: '', stderr: 'zip error', exitCode: 1 })
          await expect(
            ctx.ConversionManager.promises.convertLaTeXToDocumentInDirWithLock(
              ctx.conversionId,
              ctx.compileDir,
              ctx.rootDocPath,
              'markdown'
            )
          ).to.be.rejectedWith('zip compression of export failed')
          sinon.assert.called(ctx.lock.release)
        })
      })
    })

    describe('with an unsupported conversion type', function () {
      it('should reject with an unsupported conversion type error', async function (ctx) {
        await expect(
          ctx.ConversionManager.promises.convertLaTeXToDocumentInDirWithLock(
            ctx.conversionId,
            ctx.compileDir,
            ctx.rootDocPath,
            'not-a-real-type'
          )
        ).to.be.rejectedWith('unsupported conversion type')
      })
    })
  })
})
