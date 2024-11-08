const Path = require('node:path')
const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const sinon = require('sinon')

const MODULE_PATH = require('node:path').join(
  __dirname,
  '../../../app/js/CompileManager'
)

describe('CompileManager', function () {
  beforeEach(function () {
    this.projectId = 'project-id-123'
    this.userId = '1234'
    this.resources = 'mock-resources'
    this.outputFiles = [
      {
        path: 'output.log',
        type: 'log',
      },
      {
        path: 'output.pdf',
        type: 'pdf',
      },
    ]
    this.buildFiles = [
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
    this.buildId = 'build-id-123'
    this.commandOutput = 'Dummy output'
    this.compileBaseDir = '/compile/dir'
    this.outputBaseDir = '/output/dir'
    this.compileDir = `${this.compileBaseDir}/${this.projectId}-${this.userId}`
    this.outputDir = `${this.outputBaseDir}/${this.projectId}-${this.userId}`

    this.LatexRunner = {
      promises: {
        runLatex: sinon.stub().resolves({}),
      },
    }
    this.ResourceWriter = {
      promises: {
        syncResourcesToDisk: sinon.stub().resolves(this.resources),
      },
    }
    this.OutputFileFinder = {
      promises: {
        findOutputFiles: sinon.stub().resolves({
          outputFiles: this.outputFiles,
          allEntries: this.outputFiles.map(f => f.path).concat(['main.tex']),
        }),
      },
    }
    this.OutputCacheManager = {
      promises: {
        saveOutputFiles: sinon
          .stub()
          .resolves({ outputFiles: this.buildFiles, buildId: this.buildId }),
      },
    }
    this.Settings = {
      path: {
        compilesDir: this.compileBaseDir,
        outputDir: this.outputBaseDir,
        synctexBaseDir: sinon.stub(),
      },
      clsi: {
        docker: {
          image: 'SOMEIMAGE',
        },
      },
    }
    this.Settings.path.synctexBaseDir
      .withArgs(`${this.projectId}-${this.userId}`)
      .returns(this.compileDir)
    this.child_process = {
      exec: sinon.stub(),
      execFile: sinon.stub().yields(),
    }
    this.CommandRunner = {
      promises: {
        run: sinon.stub().callsFake((_1, _2, _3, _4, _5, _6, compileGroup) => {
          if (compileGroup === 'synctex') {
            return Promise.resolve({ stdout: this.commandOutput })
          } else {
            return Promise.resolve({
              stdout: 'Encoding: ascii\nWords in text: 2',
            })
          }
        }),
      },
    }
    this.DraftModeManager = {
      promises: {
        injectDraftMode: sinon.stub().resolves(),
      },
    }
    this.TikzManager = {
      promises: {
        checkMainFile: sinon.stub().resolves(false),
      },
    }
    this.lock = {
      release: sinon.stub(),
    }
    this.LockManager = {
      acquire: sinon.stub().returns(this.lock),
    }
    this.SynctexOutputParser = {
      parseViewOutput: sinon.stub(),
      parseEditOutput: sinon.stub(),
    }

    this.dirStats = {
      isDirectory: sinon.stub().returns(true),
    }
    this.fileStats = {
      isFile: sinon.stub().returns(true),
    }
    this.fsPromises = {
      lstat: sinon.stub(),
      stat: sinon.stub(),
      readFile: sinon.stub(),
      mkdir: sinon.stub().resolves(),
      rm: sinon.stub().resolves(),
      unlink: sinon.stub().resolves(),
      rmdir: sinon.stub().resolves(),
    }
    this.fsPromises.lstat.withArgs(this.compileDir).resolves(this.dirStats)
    this.fsPromises.stat
      .withArgs(Path.join(this.compileDir, 'output.synctex.gz'))
      .resolves(this.fileStats)

    this.CompileManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        './LatexRunner': this.LatexRunner,
        './ResourceWriter': this.ResourceWriter,
        './OutputFileFinder': this.OutputFileFinder,
        './OutputCacheManager': this.OutputCacheManager,
        '@overleaf/settings': this.Settings,
        '@overleaf/metrics': {
          inc: sinon.stub(),
          timing: sinon.stub(),
          gauge: sinon.stub(),
          Timer: sinon.stub().returns({ done: sinon.stub() }),
        },
        child_process: this.child_process,
        './CommandRunner': this.CommandRunner,
        './DraftModeManager': this.DraftModeManager,
        './TikzManager': this.TikzManager,
        './LockManager': this.LockManager,
        './SynctexOutputParser': this.SynctexOutputParser,
        'fs/promises': this.fsPromises,
      },
    })
  })

  describe('doCompileWithLock', function () {
    beforeEach(function () {
      this.request = {
        resources: this.resources,
        rootResourcePath: (this.rootResourcePath = 'main.tex'),
        project_id: this.projectId,
        user_id: this.userId,
        compiler: (this.compiler = 'pdflatex'),
        timeout: (this.timeout = 42000),
        imageName: (this.image = 'example.com/image'),
        flags: (this.flags = ['-file-line-error']),
        compileGroup: (this.compileGroup = 'compile-group'),
        stopOnFirstError: false,
      }
      this.env = {
        OVERLEAF_PROJECT_ID: this.projectId,
      }
    })

    describe('when the project is locked', function () {
      beforeEach(async function () {
        const error = new Error('locked')
        this.LockManager.acquire.throws(error)
        await expect(
          this.CompileManager.promises.doCompileWithLock(this.request)
        ).to.be.rejectedWith(error)
      })

      it('should ensure that the compile directory exists', function () {
        expect(this.fsPromises.mkdir).to.have.been.calledWith(this.compileDir, {
          recursive: true,
        })
      })

      it('should not run LaTeX', function () {
        expect(this.LatexRunner.promises.runLatex).not.to.have.been.called
      })
    })

    describe('normally', function () {
      beforeEach(async function () {
        this.result = await this.CompileManager.promises.doCompileWithLock(
          this.request
        )
      })

      it('should ensure that the compile directory exists', function () {
        expect(this.fsPromises.mkdir).to.have.been.calledWith(this.compileDir, {
          recursive: true,
        })
      })

      it('should write the resources to disk', function () {
        expect(
          this.ResourceWriter.promises.syncResourcesToDisk
        ).to.have.been.calledWith(this.request, this.compileDir)
      })

      it('should run LaTeX', function () {
        expect(this.LatexRunner.promises.runLatex).to.have.been.calledWith(
          `${this.projectId}-${this.userId}`,
          {
            directory: this.compileDir,
            mainFile: this.rootResourcePath,
            compiler: this.compiler,
            timeout: this.timeout,
            image: this.image,
            flags: this.flags,
            environment: this.env,
            compileGroup: this.compileGroup,
            stopOnFirstError: this.request.stopOnFirstError,
            stats: sinon.match.object,
            timings: sinon.match.object,
          }
        )
      })

      it('should find the output files', function () {
        expect(
          this.OutputFileFinder.promises.findOutputFiles
        ).to.have.been.calledWith(this.resources, this.compileDir)
      })

      it('should return the output files', function () {
        expect(this.result.outputFiles).to.equal(this.buildFiles)
      })

      it('should not inject draft mode by default', function () {
        expect(this.DraftModeManager.promises.injectDraftMode).not.to.have.been
          .called
      })
    })

    describe('with draft mode', function () {
      beforeEach(async function () {
        this.request.draft = true
        await this.CompileManager.promises.doCompileWithLock(this.request)
      })

      it('should inject the draft mode header', function () {
        expect(
          this.DraftModeManager.promises.injectDraftMode
        ).to.have.been.calledWith(this.compileDir + '/' + this.rootResourcePath)
      })
    })

    describe('with a check option', function () {
      beforeEach(async function () {
        this.request.check = 'error'
        await this.CompileManager.promises.doCompileWithLock(this.request)
      })

      it('should run chktex', function () {
        expect(this.LatexRunner.promises.runLatex).to.have.been.calledWith(
          `${this.projectId}-${this.userId}`,
          {
            directory: this.compileDir,
            mainFile: this.rootResourcePath,
            compiler: this.compiler,
            timeout: this.timeout,
            image: this.image,
            flags: this.flags,
            environment: {
              CHKTEX_OPTIONS: '-nall -e9 -e10 -w15 -w16',
              CHKTEX_EXIT_ON_ERROR: 1,
              CHKTEX_ULIMIT_OPTIONS: '-t 5 -v 64000',
              OVERLEAF_PROJECT_ID: this.projectId,
            },
            compileGroup: this.compileGroup,
            stopOnFirstError: this.request.stopOnFirstError,
            stats: sinon.match.object,
            timings: sinon.match.object,
          }
        )
      })
    })

    describe('with a knitr file and check options', function () {
      beforeEach(async function () {
        this.request.rootResourcePath = 'main.Rtex'
        this.request.check = 'error'
        await this.CompileManager.promises.doCompileWithLock(this.request)
      })

      it('should not run chktex', function () {
        expect(this.LatexRunner.promises.runLatex).to.have.been.calledWith(
          `${this.projectId}-${this.userId}`,
          {
            directory: this.compileDir,
            mainFile: 'main.Rtex',
            compiler: this.compiler,
            timeout: this.timeout,
            image: this.image,
            flags: this.flags,
            environment: this.env,
            compileGroup: this.compileGroup,
            stopOnFirstError: this.request.stopOnFirstError,
            stats: sinon.match.object,
            timings: sinon.match.object,
          }
        )
      })
    })

    describe('when the compile times out', function () {
      beforeEach(async function () {
        const error = new Error('timed out!')
        error.timedout = true
        this.LatexRunner.promises.runLatex.rejects(error)
        await expect(
          this.CompileManager.promises.doCompileWithLock(this.request)
        ).to.be.rejected
      })

      it('should clear the compile directory', function () {
        for (const { path } of this.buildFiles) {
          expect(this.fsPromises.unlink).to.have.been.calledWith(
            this.compileDir + '/' + path
          )
        }
        expect(this.fsPromises.unlink).to.have.been.calledWith(
          this.compileDir + '/main.tex'
        )
        expect(this.fsPromises.rmdir).to.have.been.calledWith(this.compileDir)
      })
    })

    describe('when the compile is manually stopped', function () {
      beforeEach(async function () {
        const error = new Error('terminated!')
        error.terminated = true
        this.LatexRunner.promises.runLatex.rejects(error)
        await expect(
          this.CompileManager.promises.doCompileWithLock(this.request)
        ).to.be.rejected
      })

      it('should clear the compile directory', function () {
        for (const { path } of this.buildFiles) {
          expect(this.fsPromises.unlink).to.have.been.calledWith(
            this.compileDir + '/' + path
          )
        }
        expect(this.fsPromises.unlink).to.have.been.calledWith(
          this.compileDir + '/main.tex'
        )
        expect(this.fsPromises.rmdir).to.have.been.calledWith(this.compileDir)
      })
    })
  })

  describe('clearProject', function () {
    it('should clear the compile directory', async function () {
      await this.CompileManager.promises.clearProject(
        this.projectId,
        this.userId
      )

      expect(this.fsPromises.rm).to.have.been.calledWith(this.compileDir, {
        force: true,
        recursive: true,
      })
    })
  })

  describe('syncing', function () {
    beforeEach(function () {
      this.page = 1
      this.h = 42.23
      this.v = 87.56
      this.width = 100.01
      this.height = 234.56
      this.line = 5
      this.column = 3
      this.filename = 'main.tex'
    })

    describe('syncFromCode', function () {
      beforeEach(function () {
        this.records = [{ page: 1, h: 2, v: 3, width: 4, height: 5 }]
        this.SynctexOutputParser.parseViewOutput
          .withArgs(this.commandOutput)
          .returns(this.records)
      })

      describe('normal case', function () {
        beforeEach(async function () {
          this.result = await this.CompileManager.promises.syncFromCode(
            this.projectId,
            this.userId,
            this.filename,
            this.line,
            this.column,
            ''
          )
        })

        it('should execute the synctex binary', function () {
          const outputFilePath = `${this.compileDir}/output.pdf`
          const inputFilePath = `${this.compileDir}/${this.filename}`
          expect(this.CommandRunner.promises.run).to.have.been.calledWith(
            `${this.projectId}-${this.userId}`,
            [
              'synctex',
              'view',
              '-i',
              `${this.line}:${this.column}:${inputFilePath}`,
              '-o',
              outputFilePath,
            ],
            this.compileDir,
            this.Settings.clsi.docker.image,
            60000,
            {}
          )
        })

        it('should return the parsed output', function () {
          expect(this.result).to.deep.equal(this.records)
        })
      })

      describe('with a custom imageName', function () {
        const customImageName = 'foo/bar:tag-0'
        beforeEach(async function () {
          await this.CompileManager.promises.syncFromCode(
            this.projectId,
            this.userId,
            this.filename,
            this.line,
            this.column,
            customImageName
          )
        })

        it('should execute the synctex binary in a custom docker image', function () {
          const outputFilePath = `${this.compileDir}/output.pdf`
          const inputFilePath = `${this.compileDir}/${this.filename}`
          expect(this.CommandRunner.promises.run).to.have.been.calledWith(
            `${this.projectId}-${this.userId}`,
            [
              'synctex',
              'view',
              '-i',
              `${this.line}:${this.column}:${inputFilePath}`,
              '-o',
              outputFilePath,
            ],
            this.compileDir,
            customImageName,
            60000,
            {}
          )
        })
      })
    })

    describe('syncFromPdf', function () {
      beforeEach(function () {
        this.records = [{ file: 'main.tex', line: 1, column: 1 }]
        this.SynctexOutputParser.parseEditOutput
          .withArgs(this.commandOutput, this.compileDir)
          .returns(this.records)
      })

      describe('normal case', function () {
        beforeEach(async function () {
          this.result = await this.CompileManager.promises.syncFromPdf(
            this.projectId,
            this.userId,
            this.page,
            this.h,
            this.v,
            ''
          )
        })

        it('should execute the synctex binary', function () {
          const outputFilePath = `${this.compileDir}/output.pdf`
          expect(this.CommandRunner.promises.run).to.have.been.calledWith(
            `${this.projectId}-${this.userId}`,
            [
              'synctex',
              'edit',
              '-o',
              `${this.page}:${this.h}:${this.v}:${outputFilePath}`,
            ],
            this.compileDir,
            this.Settings.clsi.docker.image,
            60000,
            {}
          )
        })

        it('should return the parsed output', function () {
          expect(this.result).to.deep.equal(this.records)
        })
      })

      describe('with a custom imageName', function () {
        const customImageName = 'foo/bar:tag-1'
        beforeEach(async function () {
          await this.CompileManager.promises.syncFromPdf(
            this.projectId,
            this.userId,
            this.page,
            this.h,
            this.v,
            customImageName
          )
        })

        it('should execute the synctex binary in a custom docker image', function () {
          const outputFilePath = `${this.compileDir}/output.pdf`
          expect(this.CommandRunner.promises.run).to.have.been.calledWith(
            `${this.projectId}-${this.userId}`,
            [
              'synctex',
              'edit',
              '-o',
              `${this.page}:${this.h}:${this.v}:${outputFilePath}`,
            ],
            this.compileDir,
            customImageName,
            60000,
            {}
          )
        })
      })
    })
  })

  describe('wordcount', function () {
    beforeEach(async function () {
      this.timeout = 60 * 1000
      this.filename = 'main.tex'
      this.image = 'example.com/image'

      this.result = await this.CompileManager.promises.wordcount(
        this.projectId,
        this.userId,
        this.filename,
        this.image
      )
    })

    it('should run the texcount command', function () {
      this.filePath = `$COMPILE_DIR/${this.filename}`
      this.command = ['texcount', '-nocol', '-inc', this.filePath]

      expect(this.CommandRunner.promises.run).to.have.been.calledWith(
        `${this.projectId}-${this.userId}`,
        this.command,
        this.compileDir,
        this.image,
        this.timeout,
        {}
      )
    })

    it('should return the parsed output', function () {
      expect(this.result).to.deep.equal({
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
