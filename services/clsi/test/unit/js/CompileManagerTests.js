const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../app/js/CompileManager'
)
const { EventEmitter } = require('events')

describe('CompileManager', function () {
  beforeEach(function () {
    this.callback = sinon.stub()
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
    this.commandOutput = 'Dummy output'
    this.compileBaseDir = '/compile/dir'
    this.outputBaseDir = '/output/dir'
    this.compileDir = `${this.compileBaseDir}/${this.projectId}-${this.userId}`
    this.outputDir = `${this.outputBaseDir}/${this.projectId}-${this.userId}`

    this.proc = new EventEmitter()
    this.proc.stdout = new EventEmitter()
    this.proc.stderr = new EventEmitter()
    this.proc.stderr.setEncoding = sinon.stub().returns(this.proc.stderr)

    this.LatexRunner = {
      runLatex: sinon.stub().yields(),
    }
    this.ResourceWriter = {
      syncResourcesToDisk: sinon.stub().yields(null, this.resources),
    }
    this.OutputFileFinder = {
      findOutputFiles: sinon.stub().yields(null, this.outputFiles),
    }
    this.OutputCacheManager = {
      saveOutputFiles: sinon.stub().yields(null, this.buildFiles),
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
      spawn: sinon.stub().returns(this.proc),
    }
    this.CommandRunner = {
      run: sinon.stub().yields(null, { stdout: this.commandOutput }),
    }
    this.DraftModeManager = {
      injectDraftMode: sinon.stub().yields(),
    }
    this.TikzManager = {
      checkMainFile: sinon.stub().yields(null, false),
    }
    this.LockManager = {
      runWithLock: sinon.stub().callsFake((lockFile, runner, callback) => {
        runner((err, ...result) => callback(err, ...result))
      }),
    }
    this.SynctexOutputParser = {
      parseViewOutput: sinon.stub(),
      parseEditOutput: sinon.stub(),
    }

    this.fs = {
      lstat: sinon.stub(),
      stat: sinon.stub(),
      readFile: sinon.stub(),
    }
    this.fse = {
      ensureDir: sinon.stub().yields(),
    }

    this.CompileManager = SandboxedModule.require(modulePath, {
      requires: {
        './LatexRunner': this.LatexRunner,
        './ResourceWriter': this.ResourceWriter,
        './OutputFileFinder': this.OutputFileFinder,
        './OutputCacheManager': this.OutputCacheManager,
        '@overleaf/settings': this.Settings,
        child_process: this.child_process,
        './CommandRunner': this.CommandRunner,
        './DraftModeManager': this.DraftModeManager,
        './TikzManager': this.TikzManager,
        './LockManager': this.LockManager,
        './SynctexOutputParser': this.SynctexOutputParser,
        fs: this.fs,
        'fs-extra': this.fse,
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
      }
      this.env = {}
    })

    describe('when the project is locked', function () {
      beforeEach(function () {
        this.error = new Error('locked')
        this.LockManager.runWithLock.callsFake((lockFile, runner, callback) => {
          callback(this.error)
        })
        this.CompileManager.doCompileWithLock(this.request, this.callback)
      })

      it('should ensure that the compile directory exists', function () {
        this.fse.ensureDir.calledWith(this.compileDir).should.equal(true)
      })

      it('should not run LaTeX', function () {
        this.LatexRunner.runLatex.called.should.equal(false)
      })

      it('should call the callback with the error', function () {
        this.callback.calledWithExactly(this.error).should.equal(true)
      })
    })

    describe('normally', function () {
      beforeEach(function () {
        this.CompileManager.doCompileWithLock(this.request, this.callback)
      })

      it('should ensure that the compile directory exists', function () {
        this.fse.ensureDir.calledWith(this.compileDir).should.equal(true)
      })

      it('should write the resources to disk', function () {
        this.ResourceWriter.syncResourcesToDisk
          .calledWith(this.request, this.compileDir)
          .should.equal(true)
      })

      it('should run LaTeX', function () {
        this.LatexRunner.runLatex
          .calledWith(`${this.projectId}-${this.userId}`, {
            directory: this.compileDir,
            mainFile: this.rootResourcePath,
            compiler: this.compiler,
            timeout: this.timeout,
            image: this.image,
            flags: this.flags,
            environment: this.env,
            compileGroup: this.compileGroup,
          })
          .should.equal(true)
      })

      it('should find the output files', function () {
        this.OutputFileFinder.findOutputFiles
          .calledWith(this.resources, this.compileDir)
          .should.equal(true)
      })

      it('should return the output files', function () {
        this.callback.calledWith(null, this.buildFiles).should.equal(true)
      })

      it('should not inject draft mode by default', function () {
        this.DraftModeManager.injectDraftMode.called.should.equal(false)
      })
    })

    describe('with draft mode', function () {
      beforeEach(function () {
        this.request.draft = true
        this.CompileManager.doCompileWithLock(this.request, this.callback)
      })

      it('should inject the draft mode header', function () {
        this.DraftModeManager.injectDraftMode
          .calledWith(this.compileDir + '/' + this.rootResourcePath)
          .should.equal(true)
      })
    })

    describe('with a check option', function () {
      beforeEach(function () {
        this.request.check = 'error'
        this.CompileManager.doCompileWithLock(this.request, this.callback)
      })

      it('should run chktex', function () {
        this.LatexRunner.runLatex
          .calledWith(`${this.projectId}-${this.userId}`, {
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
            },
            compileGroup: this.compileGroup,
          })
          .should.equal(true)
      })
    })

    describe('with a knitr file and check options', function () {
      beforeEach(function () {
        this.request.rootResourcePath = 'main.Rtex'
        this.request.check = 'error'
        this.CompileManager.doCompileWithLock(this.request, this.callback)
      })

      it('should not run chktex', function () {
        this.LatexRunner.runLatex
          .calledWith(`${this.projectId}-${this.userId}`, {
            directory: this.compileDir,
            mainFile: 'main.Rtex',
            compiler: this.compiler,
            timeout: this.timeout,
            image: this.image,
            flags: this.flags,
            environment: this.env,
            compileGroup: this.compileGroup,
          })
          .should.equal(true)
      })
    })
  })

  describe('clearProject', function () {
    describe('succesfully', function () {
      beforeEach(function () {
        this.Settings.compileDir = 'compiles'
        this.fs.lstat.yields(null, {
          isDirectory() {
            return true
          },
        })
        this.CompileManager.clearProject(
          this.projectId,
          this.userId,
          this.callback
        )
        this.proc.emit('close', 0)
      })

      it('should remove the project directory', function () {
        this.child_process.spawn
          .calledWith('rm', ['-r', '-f', '--', this.compileDir, this.outputDir])
          .should.equal(true)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('with a non-success status code', function () {
      beforeEach(function () {
        this.Settings.compileDir = 'compiles'
        this.fs.lstat.yields(null, {
          isDirectory() {
            return true
          },
        })
        this.CompileManager.clearProject(
          this.projectId,
          this.userId,
          this.callback
        )
        this.proc.stderr.emit('data', (this.error = 'oops'))
        this.proc.emit('close', 1)
      })

      it('should remove the project directory', function () {
        this.child_process.spawn
          .calledWith('rm', ['-r', '-f', '--', this.compileDir, this.outputDir])
          .should.equal(true)
      })

      it('should call the callback with an error from the stderr', function () {
        this.callback.calledWithExactly(sinon.match(Error)).should.equal(true)

        this.callback.args[0][0].message.should.equal(
          `rm -r ${this.compileDir} ${this.outputDir} failed: ${this.error}`
        )
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
        this.fs.stat.yields(null, {
          isFile() {
            return true
          },
        })
        this.records = [{ page: 1, h: 2, v: 3, width: 4, height: 5 }]
        this.SynctexOutputParser.parseViewOutput
          .withArgs(this.commandOutput)
          .returns(this.records)
        this.CompileManager.syncFromCode(
          this.projectId,
          this.userId,
          this.filename,
          this.line,
          this.column,
          '',
          this.callback
        )
      })

      it('should execute the synctex binary', function () {
        const outputFilePath = `${this.compileDir}/output.pdf`
        const inputFilePath = `${this.compileDir}/${this.filename}`
        this.CommandRunner.run.should.have.been.calledWith(
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

      it('should call the callback with the parsed output', function () {
        this.callback.should.have.been.calledWith(
          null,
          sinon.match.array.deepEquals(this.records)
        )
      })

      describe('with a custom imageName', function () {
        const customImageName = 'foo/bar:tag-0'
        beforeEach(function () {
          this.CommandRunner.run.reset()
          this.CompileManager.syncFromCode(
            this.projectId,
            this.userId,
            this.filename,
            this.line,
            this.column,
            customImageName,
            this.callback
          )
        })

        it('should execute the synctex binary in a custom docker image', function () {
          const outputFilePath = `${this.compileDir}/output.pdf`
          const inputFilePath = `${this.compileDir}/${this.filename}`
          this.CommandRunner.run.should.have.been.calledWith(
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
        this.fs.stat.yields(null, {
          isFile() {
            return true
          },
        })
        this.records = [{ file: 'main.tex', line: 1, column: 1 }]
        this.SynctexOutputParser.parseEditOutput
          .withArgs(this.commandOutput, this.compileDir)
          .returns(this.records)
        this.CompileManager.syncFromPdf(
          this.projectId,
          this.userId,
          this.page,
          this.h,
          this.v,
          '',
          this.callback
        )
      })

      it('should execute the synctex binary', function () {
        const outputFilePath = `${this.compileDir}/output.pdf`
        this.CommandRunner.run.should.have.been.calledWith(
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

      it('should call the callback with the parsed output', function () {
        this.callback.should.have.been.calledWith(
          null,
          sinon.match.array.deepEquals(this.records)
        )
      })

      describe('with a custom imageName', function () {
        const customImageName = 'foo/bar:tag-1'
        beforeEach(function () {
          this.CommandRunner.run.reset()
          this.CompileManager.syncFromPdf(
            this.projectId,
            this.userId,
            this.page,
            this.h,
            this.v,
            customImageName,
            this.callback
          )
        })

        it('should execute the synctex binary in a custom docker image', function () {
          const outputFilePath = `${this.compileDir}/output.pdf`
          this.CommandRunner.run
            .calledWith(
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
            .should.equal(true)
        })
      })
    })
  })

  describe('wordcount', function () {
    beforeEach(function () {
      this.stdout = 'Encoding: ascii\nWords in text: 2'
      this.fs.readFile.yields(null, this.stdout)

      this.timeout = 60 * 1000
      this.filename = 'main.tex'
      this.image = 'example.com/image'

      this.CompileManager.wordcount(
        this.projectId,
        this.userId,
        this.filename,
        this.image,
        this.callback
      )
    })

    it('should run the texcount command', function () {
      this.filePath = `$COMPILE_DIR/${this.filename}`
      this.command = [
        'texcount',
        '-nocol',
        '-inc',
        this.filePath,
        `-out=${this.filePath}.wc`,
      ]

      this.CommandRunner.run
        .calledWith(
          `${this.projectId}-${this.userId}`,
          this.command,
          this.compileDir,
          this.image,
          this.timeout,
          {}
        )
        .should.equal(true)
    })

    it('should call the callback with the parsed output', function () {
      this.callback
        .calledWith(null, {
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
        .should.equal(true)
    })
  })
})
