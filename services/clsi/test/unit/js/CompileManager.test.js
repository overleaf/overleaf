import { vi, expect, describe, beforeEach, it } from 'vitest'
import Path from 'node:path'
import sinon from 'sinon'
import Metrics from '../../../app/js/Metrics.js'

const MODULE_PATH = Path.join(
  import.meta.dirname,
  '../../../app/js/CompileManager'
)

describe('CompileManager', () => {
  beforeEach(async ctx => {
    ctx.projectId = 'project-id-123'
    ctx.userId = '1234'
    ctx.resources = 'mock-resources'
    ctx.outputFiles = [
      {
        path: 'output.log',
        type: 'log',
      },
      {
        path: 'output.pdf',
        type: 'pdf',
      },
    ]
    ctx.buildFiles = [
      {
        path: 'output.log',
        type: 'log',
        build: 1234,
      },
      {
        path: 'output.pdf',
        type: 'pdf',
        build: 1234,
      },
    ]
    ctx.buildId = '00000000000-0000000000000000'
    ctx.commandOutput = 'Dummy output'
    ctx.compileBaseDir = '/compile/dir'
    ctx.outputBaseDir = '/output/dir'
    ctx.compileDir = `${ctx.compileBaseDir}/${ctx.projectId}-${ctx.userId}`
    ctx.outputDir = `${ctx.outputBaseDir}/${ctx.projectId}-${ctx.userId}`

    ctx.LatexRunner = {
      promises: {
        runLatex: sinon.stub().resolves({}),
      },
    }
    ctx.ResourceWriter = {
      promises: {
        syncResourcesToDisk: sinon.stub().resolves(ctx.resources),
      },
    }
    ctx.OutputFileFinder = {
      promises: {
        findOutputFiles: sinon.stub().resolves({
          outputFiles: ctx.outputFiles,
          allEntries: ctx.outputFiles.map(f => f.path).concat(['main.tex']),
        }),
      },
    }
    ctx.OutputCacheManager = {
      BUILD_REGEX: /^[0-9a-f]+-[0-9a-f]+$/,
      CACHE_SUBDIR: 'generated-files',
      promises: {
        queueDirOperation: sinon.stub().callsArg(1),
        saveOutputFiles: sinon
          .stub()
          .resolves({ outputFiles: ctx.buildFiles, buildId: ctx.buildId }),
      },
    }
    ctx.Settings = {
      path: {
        compilesDir: ctx.compileBaseDir,
        outputDir: ctx.outputBaseDir,
        synctexBaseDir: sinon.stub(),
      },
      clsi: {
        docker: {
          image: 'SOMEIMAGE',
        },
      },
    }
    ctx.Settings.path.synctexBaseDir
      .withArgs(`${ctx.projectId}-${ctx.userId}`)
      .returns(ctx.compileDir)
    ctx.child_process = {
      exec: sinon.stub(),
      execFile: sinon.stub().yields(),
    }
    ctx.CommandRunner = {
      canRunSyncTeXInOutputDir: sinon.stub().returns(false),
      promises: {
        run: sinon.stub().callsFake((_1, _2, _3, _4, _5, _6, compileGroup) => {
          if (compileGroup === 'synctex' || compileGroup === 'synctex-output') {
            return Promise.resolve({ stdout: ctx.commandOutput })
          } else {
            return Promise.resolve({
              stdout: 'Encoding: ascii\nWords in text: 2',
            })
          }
        }),
      },
    }
    ctx.DraftModeManager = {
      promises: {
        injectDraftMode: sinon.stub().resolves(),
      },
    }
    ctx.TikzManager = {
      promises: {
        checkMainFile: sinon.stub().resolves(false),
      },
    }
    ctx.lock = {
      release: sinon.stub(),
    }
    ctx.LockManager = {
      acquire: sinon.stub().returns(ctx.lock),
    }
    ctx.SynctexOutputParser = {
      parseViewOutput: sinon.stub(),
      parseEditOutput: sinon.stub(),
    }

    ctx.dirStats = {
      isDirectory: sinon.stub().returns(true),
    }
    ctx.fileStats = {
      isFile: sinon.stub().returns(true),
    }
    ctx.fsPromises = {
      lstat: sinon.stub(),
      stat: sinon.stub(),
      readFile: sinon.stub(),
      mkdir: sinon.stub().resolves(),
      rm: sinon.stub().resolves(),
      unlink: sinon.stub().resolves(),
      rmdir: sinon.stub().resolves(),
    }
    ctx.fsPromises.lstat.withArgs(ctx.compileDir).resolves(ctx.dirStats)
    ctx.fsPromises.stat
      .withArgs(Path.join(ctx.compileDir, 'output.synctex.gz'))
      .resolves(ctx.fileStats)

    ctx.CLSICacheHandler = {
      notifyCLSICacheAboutBuild: sinon.stub(),
      downloadLatestCompileCache: sinon.stub().resolves(),
      downloadOutputDotSynctexFromCompileCache: sinon.stub().resolves(),
    }

    ctx.LatexMetrics = { enableLatexMkMetrics: sinon.stub() }

    ctx.StatsManager = { sampleRequest: sinon.stub().returns(false) }

    vi.doMock('../../../app/js/LatexRunner', () => ({
      default: ctx.LatexRunner,
    }))

    vi.doMock('../../../app/js/ResourceWriter', () => ({
      default: ctx.ResourceWriter,
    }))

    vi.doMock('../../../app/js/OutputFileFinder', () => ({
      default: ctx.OutputFileFinder,
    }))

    vi.doMock('../../../app/js/OutputCacheManager', () => ({
      default: ctx.OutputCacheManager,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: {
        inc: sinon.stub(),
        timing: sinon.stub(),
        gauge: sinon.stub(),
        Timer: sinon.stub().returns({ done: sinon.stub() }),
      },
    }))

    vi.doMock('child_process', () => ({
      default: ctx.child_process,
    }))

    vi.doMock('../../../app/js/CommandRunner', () => ({
      default: ctx.CommandRunner,
    }))

    vi.doMock('../../../app/js/DraftModeManager', () => ({
      default: ctx.DraftModeManager,
    }))

    vi.doMock('../../../app/js/TikzManager', () => ({
      default: ctx.TikzManager,
    }))

    vi.doMock('../../../app/js/LockManager', () => ({
      default: ctx.LockManager,
    }))

    vi.doMock('../../../app/js/SynctexOutputParser', () => ({
      default: ctx.SynctexOutputParser,
    }))

    vi.doMock('fs/promises', () => ({
      default: ctx.fsPromises,
    }))

    vi.doMock('../../../app/js/CLSICacheHandler', () => ({
      default: ctx.CLSICacheHandler,
    }))

    vi.doMock('../../../app/js/LatexMetrics', () => ({
      default: ctx.LatexMetrics,
    }))

    vi.doMock('../../../app/js/StatsManager', () => ({
      default: ctx.StatsManager,
    }))

    vi.doMock('../../../app/js/Metrics', () => ({
      default: Metrics,
    }))

    ctx.CompileManager = (await import(MODULE_PATH)).default
  })

  describe('doCompileWithLock', () => {
    beforeEach(ctx => {
      ctx.request = {
        resources: ctx.resources,
        rootResourcePath: (ctx.rootResourcePath = 'main.tex'),
        project_id: ctx.projectId,
        user_id: ctx.userId,
        compiler: (ctx.compiler = 'pdflatex'),
        timeout: (ctx.timeout = 42000),
        imageName: (ctx.image = 'example.com/image'),
        flags: (ctx.flags = ['-file-line-error']),
        compileGroup: (ctx.compileGroup = 'compile-group'),
        stopOnFirstError: false,
        metricsOpts: {
          path: 'clsi-perf',
          method: 'minimal',
          compile: 'initial',
        },
      }
      ctx.env = {
        OVERLEAF_PROJECT_ID: ctx.projectId,
      }
    })

    describe('when the project is locked', () => {
      beforeEach(async ctx => {
        const error = new Error('locked')
        ctx.LockManager.acquire.throws(error)
        await expect(
          ctx.CompileManager.promises.doCompileWithLock(ctx.request, {}, {})
        ).to.be.rejectedWith(error)
      })

      it('should ensure that the compile directory exists', ctx => {
        expect(ctx.fsPromises.mkdir).to.have.been.calledWith(ctx.compileDir, {
          recursive: true,
        })
      })

      it('should not run LaTeX', ctx => {
        expect(ctx.LatexRunner.promises.runLatex).not.to.have.been.called
      })
    })

    describe('normally', () => {
      beforeEach(async ctx => {
        ctx.result = await ctx.CompileManager.promises.doCompileWithLock(
          ctx.request,
          {},
          {}
        )
      })

      it('should ensure that the compile directory exists', ctx => {
        expect(ctx.fsPromises.mkdir).to.have.been.calledWith(ctx.compileDir, {
          recursive: true,
        })
      })

      it('should write the resources to disk', ctx => {
        expect(
          ctx.ResourceWriter.promises.syncResourcesToDisk
        ).to.have.been.calledWith(ctx.request, ctx.compileDir)
      })

      it('should run LaTeX', ctx => {
        expect(ctx.LatexRunner.promises.runLatex).to.have.been.calledWith(
          `${ctx.projectId}-${ctx.userId}`,
          {
            directory: ctx.compileDir,
            mainFile: ctx.rootResourcePath,
            compiler: ctx.compiler,
            timeout: ctx.timeout,
            image: ctx.image,
            flags: ctx.flags,
            environment: ctx.env,
            compileGroup: ctx.compileGroup,
            stopOnFirstError: ctx.request.stopOnFirstError,
            stats: sinon.match.object,
            timings: sinon.match.object,
          }
        )
      })

      it('should find the output files', ctx => {
        expect(
          ctx.OutputFileFinder.promises.findOutputFiles
        ).to.have.been.calledWith(ctx.resources, ctx.compileDir)
      })

      it('should return the output files', ctx => {
        expect(ctx.result.outputFiles).to.equal(ctx.buildFiles)
      })

      it('should not inject draft mode by default', ctx => {
        expect(ctx.DraftModeManager.promises.injectDraftMode).not.to.have.been
          .called
      })
    })

    describe('with performance metric collection', () => {
      it('should enable latexmk metrics when sampleRequest returns true', async ctx => {
        ctx.StatsManager.sampleRequest.returns(true)
        await ctx.CompileManager.promises.doCompileWithLock(ctx.request, {}, {})
        expect(ctx.LatexMetrics.enableLatexMkMetrics).to.have.been.calledWith(
          sinon.match.object
        )
      })

      it('should enable latexmk metrics when sampleRequest returns false', async ctx => {
        ctx.StatsManager.sampleRequest.returns(false)
        await ctx.CompileManager.promises.doCompileWithLock(ctx.request, {}, {})
        expect(ctx.LatexMetrics.enableLatexMkMetrics).to.have.been.calledWith(
          sinon.match.object
        )
      })

      it('should enable latexmk metrics when sampleRequest returns undefined', async ctx => {
        ctx.StatsManager.sampleRequest.returns(undefined)
        await ctx.CompileManager.promises.doCompileWithLock(ctx.request, {}, {})
        expect(ctx.LatexMetrics.enableLatexMkMetrics).to.have.been.calledWith(
          sinon.match.object
        )
      })
    })

    describe('with draft mode', () => {
      beforeEach(async ctx => {
        ctx.request.draft = true
        await ctx.CompileManager.promises.doCompileWithLock(ctx.request, {}, {})
      })

      it('should inject the draft mode header', ctx => {
        expect(
          ctx.DraftModeManager.promises.injectDraftMode
        ).to.have.been.calledWith(ctx.compileDir + '/' + ctx.rootResourcePath)
      })
    })

    describe('with a check option', () => {
      beforeEach(async ctx => {
        ctx.request.check = 'error'
        await ctx.CompileManager.promises.doCompileWithLock(ctx.request, {}, {})
      })

      it('should run chktex', ctx => {
        expect(ctx.LatexRunner.promises.runLatex).to.have.been.calledWith(
          `${ctx.projectId}-${ctx.userId}`,
          {
            directory: ctx.compileDir,
            mainFile: ctx.rootResourcePath,
            compiler: ctx.compiler,
            timeout: ctx.timeout,
            image: ctx.image,
            flags: ctx.flags,
            environment: {
              CHKTEX_OPTIONS: '-nall -e9 -e10 -w15 -w16',
              CHKTEX_EXIT_ON_ERROR: 1,
              CHKTEX_ULIMIT_OPTIONS: '-t 5 -v 64000',
              OVERLEAF_PROJECT_ID: ctx.projectId,
            },
            compileGroup: ctx.compileGroup,
            stopOnFirstError: ctx.request.stopOnFirstError,
            stats: sinon.match.object,
            timings: sinon.match.object,
          }
        )
      })
    })

    describe('with a knitr file and check options', () => {
      beforeEach(async ctx => {
        ctx.request.rootResourcePath = 'main.Rtex'
        ctx.request.check = 'error'
        await ctx.CompileManager.promises.doCompileWithLock(ctx.request, {}, {})
      })

      it('should not run chktex', ctx => {
        expect(ctx.LatexRunner.promises.runLatex).to.have.been.calledWith(
          `${ctx.projectId}-${ctx.userId}`,
          {
            directory: ctx.compileDir,
            mainFile: 'main.Rtex',
            compiler: ctx.compiler,
            timeout: ctx.timeout,
            image: ctx.image,
            flags: ctx.flags,
            environment: ctx.env,
            compileGroup: ctx.compileGroup,
            stopOnFirstError: ctx.request.stopOnFirstError,
            stats: sinon.match.object,
            timings: sinon.match.object,
          }
        )
      })
    })

    describe('when the compile times out', () => {
      beforeEach(async ctx => {
        const error = new Error('timed out!')
        error.timedout = true
        ctx.LatexRunner.promises.runLatex.rejects(error)
        await expect(
          ctx.CompileManager.promises.doCompileWithLock(ctx.request, {}, {})
        ).to.be.rejected
      })

      it('should clear the compile directory', ctx => {
        for (const { path } of ctx.buildFiles) {
          expect(ctx.fsPromises.unlink).to.have.been.calledWith(
            ctx.compileDir + '/' + path
          )
        }
        expect(ctx.fsPromises.unlink).to.have.been.calledWith(
          ctx.compileDir + '/main.tex'
        )
        expect(ctx.fsPromises.rmdir).to.have.been.calledWith(ctx.compileDir)
      })
    })

    describe('when the compile is manually stopped', () => {
      beforeEach(async ctx => {
        const error = new Error('terminated!')
        error.terminated = true
        ctx.LatexRunner.promises.runLatex.rejects(error)
        await expect(
          ctx.CompileManager.promises.doCompileWithLock(ctx.request, {}, {})
        ).to.be.rejected
      })

      it('should clear the compile directory', ctx => {
        for (const { path } of ctx.buildFiles) {
          expect(ctx.fsPromises.unlink).to.have.been.calledWith(
            ctx.compileDir + '/' + path
          )
        }
        expect(ctx.fsPromises.unlink).to.have.been.calledWith(
          ctx.compileDir + '/main.tex'
        )
        expect(ctx.fsPromises.rmdir).to.have.been.calledWith(ctx.compileDir)
      })
    })
  })

  describe('clearProject', () => {
    it('should clear the compile directory', async ctx => {
      await ctx.CompileManager.promises.clearProject(ctx.projectId, ctx.userId)

      expect(ctx.fsPromises.rm).to.have.been.calledWith(ctx.compileDir, {
        force: true,
        recursive: true,
      })
    })
  })

  describe('syncing', () => {
    beforeEach(ctx => {
      ctx.page = 1
      ctx.h = 42.23
      ctx.v = 87.56
      ctx.width = 100.01
      ctx.height = 234.56
      ctx.line = 5
      ctx.column = 3
      ctx.filename = 'main.tex'
    })

    describe('syncFromCode', () => {
      beforeEach(ctx => {
        ctx.records = [{ page: 1, h: 2, v: 3, width: 4, height: 5 }]
        ctx.SynctexOutputParser.parseViewOutput
          .withArgs(ctx.commandOutput)
          .returns(ctx.records)
      })

      describe('normal case', () => {
        beforeEach(async ctx => {
          ctx.result = await ctx.CompileManager.promises.syncFromCode(
            ctx.projectId,
            ctx.userId,
            ctx.filename,
            ctx.line,
            ctx.column,
            ''
          )
        })

        it('should execute the synctex binary', ctx => {
          const outputFilePath = `${ctx.compileDir}/output.pdf`
          const inputFilePath = `${ctx.compileDir}/${ctx.filename}`
          expect(ctx.CommandRunner.promises.run).to.have.been.calledWith(
            `${ctx.projectId}-${ctx.userId}`,
            [
              'synctex',
              'view',
              '-i',
              `${ctx.line}:${ctx.column}:${inputFilePath}`,
              '-o',
              outputFilePath,
            ],
            ctx.compileDir,
            ctx.Settings.clsi.docker.image,
            60000,
            {},
            'synctex'
          )
        })

        it('should return the parsed output', ctx => {
          expect(ctx.result).to.deep.equal({
            codePositions: ctx.records,
            downloadedFromCache: false,
          })
        })
      })

      describe('from cache in docker', () => {
        beforeEach(async ctx => {
          ctx.CommandRunner.canRunSyncTeXInOutputDir.returns(true)
          ctx.Settings.path.synctexBaseDir
            .withArgs(`${ctx.projectId}-${ctx.userId}`)
            .returns('/compile')

          const errNotFound = new Error()
          errNotFound.code = 'ENOENT'
          ctx.outputDir = `${ctx.outputBaseDir}/${ctx.projectId}-${ctx.userId}/${ctx.OutputCacheManager.CACHE_SUBDIR}/${ctx.buildId}`
          const filename = Path.join(ctx.outputDir, 'output.synctex.gz')
          ctx.fsPromises.stat
            .withArgs(ctx.outputDir)
            .onFirstCall()
            .rejects(errNotFound)
          ctx.fsPromises.stat
            .withArgs(ctx.outputDir)
            .onSecondCall()
            .resolves(ctx.dirStats)
          ctx.fsPromises.stat.withArgs(filename).resolves(ctx.fileStats)
          ctx.CLSICacheHandler.downloadOutputDotSynctexFromCompileCache.resolves(
            true
          )
          ctx.result = await ctx.CompileManager.promises.syncFromCode(
            ctx.projectId,
            ctx.userId,
            ctx.filename,
            ctx.line,
            ctx.column,
            {
              imageName: 'image',
              editorId: '00000000-0000-0000-0000-000000000000',
              buildId: ctx.buildId,
              compileFromClsiCache: true,
            }
          )
        })

        it('should run in output dir', ctx => {
          const outputFilePath = '/compile/output.pdf'
          const inputFilePath = `/compile/${ctx.filename}`
          expect(ctx.CommandRunner.promises.run).to.have.been.calledWith(
            `${ctx.projectId}-${ctx.userId}`,
            [
              'synctex',
              'view',
              '-i',
              `${ctx.line}:${ctx.column}:${inputFilePath}`,
              '-o',
              outputFilePath,
            ],
            ctx.outputDir,
            'image',
            60000,
            {},
            'synctex-output'
          )
        })

        it('should return the parsed output', ctx => {
          expect(ctx.result).to.deep.equal({
            codePositions: ctx.records,
            downloadedFromCache: true,
          })
        })
      })

      describe('with a custom imageName', () => {
        const customImageName = 'foo/bar:tag-0'
        beforeEach(async ctx => {
          await ctx.CompileManager.promises.syncFromCode(
            ctx.projectId,
            ctx.userId,
            ctx.filename,
            ctx.line,
            ctx.column,
            { imageName: customImageName }
          )
        })

        it('should execute the synctex binary in a custom docker image', ctx => {
          const outputFilePath = `${ctx.compileDir}/output.pdf`
          const inputFilePath = `${ctx.compileDir}/${ctx.filename}`
          expect(ctx.CommandRunner.promises.run).to.have.been.calledWith(
            `${ctx.projectId}-${ctx.userId}`,
            [
              'synctex',
              'view',
              '-i',
              `${ctx.line}:${ctx.column}:${inputFilePath}`,
              '-o',
              outputFilePath,
            ],
            ctx.compileDir,
            customImageName,
            60000,
            {},
            'synctex'
          )
        })
      })
    })

    describe('syncFromPdf', () => {
      beforeEach(ctx => {
        ctx.records = [{ file: 'main.tex', line: 1, column: 1 }]
        ctx.SynctexOutputParser.parseEditOutput
          .withArgs(ctx.commandOutput, ctx.compileDir)
          .returns(ctx.records)
      })

      describe('normal case', () => {
        beforeEach(async ctx => {
          ctx.result = await ctx.CompileManager.promises.syncFromPdf(
            ctx.projectId,
            ctx.userId,
            ctx.page,
            ctx.h,
            ctx.v,
            { imageName: '' }
          )
        })

        it('should execute the synctex binary', ctx => {
          const outputFilePath = `${ctx.compileDir}/output.pdf`
          expect(ctx.CommandRunner.promises.run).to.have.been.calledWith(
            `${ctx.projectId}-${ctx.userId}`,
            [
              'synctex',
              'edit',
              '-o',
              `${ctx.page}:${ctx.h}:${ctx.v}:${outputFilePath}`,
            ],
            ctx.compileDir,
            ctx.Settings.clsi.docker.image,
            60000,
            {}
          )
        })

        it('should return the parsed output', ctx => {
          expect(ctx.result).to.deep.equal({
            pdfPositions: ctx.records,
            downloadedFromCache: false,
          })
        })
      })

      describe('with a custom imageName', () => {
        const customImageName = 'foo/bar:tag-1'
        beforeEach(async ctx => {
          await ctx.CompileManager.promises.syncFromPdf(
            ctx.projectId,
            ctx.userId,
            ctx.page,
            ctx.h,
            ctx.v,
            { imageName: customImageName }
          )
        })

        it('should execute the synctex binary in a custom docker image', ctx => {
          const outputFilePath = `${ctx.compileDir}/output.pdf`
          expect(ctx.CommandRunner.promises.run).to.have.been.calledWith(
            `${ctx.projectId}-${ctx.userId}`,
            [
              'synctex',
              'edit',
              '-o',
              `${ctx.page}:${ctx.h}:${ctx.v}:${outputFilePath}`,
            ],
            ctx.compileDir,
            customImageName,
            60000,
            {}
          )
        })
      })
    })
  })

  describe('wordcount', () => {
    beforeEach(async ctx => {
      ctx.timeout = 60 * 1000
      ctx.filename = 'main.tex'
      ctx.image = 'example.com/image'

      ctx.result = await ctx.CompileManager.promises.wordcount(
        ctx.projectId,
        ctx.userId,
        ctx.filename,
        ctx.image
      )
    })

    it('should run the texcount command', ctx => {
      ctx.filePath = `$COMPILE_DIR/${ctx.filename}`
      ctx.command = ['texcount', '-nocol', '-inc', ctx.filePath]

      expect(ctx.CommandRunner.promises.run).to.have.been.calledWith(
        `${ctx.projectId}-${ctx.userId}`,
        ctx.command,
        ctx.compileDir,
        ctx.image,
        ctx.timeout,
        {}
      )
    })

    it('should return the parsed output', ctx => {
      expect(ctx.result).to.deep.equal({
        encode: 'ascii',
        textWords: 2,
        headWords: 0,
        outside: 0,
        headers: 0,
        elements: 0,
        mathInline: 0,
        mathDisplay: 0,
        errors: 0,
        messages: '',
      })
    })
  })
})
