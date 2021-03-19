/* eslint-disable
    camelcase,
    chai-friendly/no-unused-expressions,
    no-path-concat,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../app/js/CompileManager'
)
const tk = require('timekeeper')
const { EventEmitter } = require('events')
const Path = require('path')

describe('CompileManager', function () {
  beforeEach(function () {
    this.CompileManager = SandboxedModule.require(modulePath, {
      requires: {
        './LatexRunner': (this.LatexRunner = {}),
        './ResourceWriter': (this.ResourceWriter = {}),
        './OutputFileFinder': (this.OutputFileFinder = {}),
        './OutputCacheManager': (this.OutputCacheManager = {}),
        'settings-sharelatex': (this.Settings = {
          path: {
            compilesDir: '/compiles/dir',
            outputDir: '/output/dir'
          },
          synctexBaseDir() {
            return '/compile'
          },
          clsi: {
            docker: {
              image: 'SOMEIMAGE'
            }
          }
        }),

        child_process: (this.child_process = {}),
        './CommandRunner': (this.CommandRunner = {}),
        './DraftModeManager': (this.DraftModeManager = {}),
        './TikzManager': (this.TikzManager = {}),
        './LockManager': (this.LockManager = {}),
        fs: (this.fs = {}),
        'fs-extra': (this.fse = { ensureDir: sinon.stub().callsArg(1) })
      }
    })
    this.callback = sinon.stub()
    this.project_id = 'project-id-123'
    return (this.user_id = '1234')
  })
  describe('doCompileWithLock', function () {
    beforeEach(function () {
      this.request = {
        resources: (this.resources = 'mock-resources'),
        project_id: this.project_id,
        user_id: this.user_id
      }
      this.output_files = ['foo', 'bar']
      this.Settings.compileDir = 'compiles'
      this.compileDir = `${this.Settings.path.compilesDir}/${this.project_id}-${this.user_id}`
      this.CompileManager.doCompile = sinon
        .stub()
        .callsArgWith(1, null, this.output_files)
      return (this.LockManager.runWithLock = (lockFile, runner, callback) =>
        runner((err, ...result) => callback(err, ...Array.from(result))))
    })

    describe('when the project is not locked', function () {
      beforeEach(function () {
        return this.CompileManager.doCompileWithLock(
          this.request,
          this.callback
        )
      })

      it('should ensure that the compile directory exists', function () {
        return this.fse.ensureDir.calledWith(this.compileDir).should.equal(true)
      })

      it('should call doCompile with the request', function () {
        return this.CompileManager.doCompile
          .calledWith(this.request)
          .should.equal(true)
      })

      return it('should call the callback with the output files', function () {
        return this.callback
          .calledWithExactly(null, this.output_files)
          .should.equal(true)
      })
    })

    return describe('when the project is locked', function () {
      beforeEach(function () {
        this.error = new Error('locked')
        this.LockManager.runWithLock = (lockFile, runner, callback) => {
          return callback(this.error)
        }
        return this.CompileManager.doCompileWithLock(
          this.request,
          this.callback
        )
      })

      it('should ensure that the compile directory exists', function () {
        return this.fse.ensureDir.calledWith(this.compileDir).should.equal(true)
      })

      it('should not call doCompile with the request', function () {
        return this.CompileManager.doCompile.called.should.equal(false)
      })

      return it('should call the callback with the error', function () {
        return this.callback.calledWithExactly(this.error).should.equal(true)
      })
    })
  })

  describe('doCompile', function () {
    beforeEach(function () {
      this.output_files = [
        {
          path: 'output.log',
          type: 'log'
        },
        {
          path: 'output.pdf',
          type: 'pdf'
        }
      ]
      this.build_files = [
        {
          path: 'output.log',
          type: 'log',
          build: 1234
        },
        {
          path: 'output.pdf',
          type: 'pdf',
          build: 1234
        }
      ]
      this.request = {
        resources: (this.resources = 'mock-resources'),
        rootResourcePath: (this.rootResourcePath = 'main.tex'),
        project_id: this.project_id,
        user_id: this.user_id,
        compiler: (this.compiler = 'pdflatex'),
        timeout: (this.timeout = 42000),
        imageName: (this.image = 'example.com/image'),
        flags: (this.flags = ['-file-line-error']),
        compileGroup: (this.compileGroup = 'compile-group')
      }
      this.env = {}
      this.Settings.compileDir = 'compiles'
      this.compileDir = `${this.Settings.path.compilesDir}/${this.project_id}-${this.user_id}`
      this.outputDir = `${this.Settings.path.outputDir}/${this.project_id}-${this.user_id}`
      this.ResourceWriter.syncResourcesToDisk = sinon
        .stub()
        .callsArgWith(2, null, this.resources)
      this.LatexRunner.runLatex = sinon.stub().callsArg(2)
      this.OutputFileFinder.findOutputFiles = sinon
        .stub()
        .callsArgWith(2, null, this.output_files)
      this.OutputCacheManager.saveOutputFiles = sinon
        .stub()
        .callsArgWith(3, null, this.build_files)
      this.DraftModeManager.injectDraftMode = sinon.stub().callsArg(1)
      return (this.TikzManager.checkMainFile = sinon.stub().callsArg(3, false))
    })

    describe('normally', function () {
      beforeEach(function () {
        return this.CompileManager.doCompile(this.request, this.callback)
      })

      it('should write the resources to disk', function () {
        return this.ResourceWriter.syncResourcesToDisk
          .calledWith(this.request, this.compileDir)
          .should.equal(true)
      })

      it('should run LaTeX', function () {
        return this.LatexRunner.runLatex
          .calledWith(`${this.project_id}-${this.user_id}`, {
            directory: this.compileDir,
            mainFile: this.rootResourcePath,
            compiler: this.compiler,
            timeout: this.timeout,
            image: this.image,
            flags: this.flags,
            environment: this.env,
            compileGroup: this.compileGroup
          })
          .should.equal(true)
      })

      it('should find the output files', function () {
        return this.OutputFileFinder.findOutputFiles
          .calledWith(this.resources, this.compileDir)
          .should.equal(true)
      })

      it('should return the output files', function () {
        return this.callback
          .calledWith(null, this.build_files)
          .should.equal(true)
      })

      return it('should not inject draft mode by default', function () {
        return this.DraftModeManager.injectDraftMode.called.should.equal(false)
      })
    })

    describe('with draft mode', function () {
      beforeEach(function () {
        this.request.draft = true
        return this.CompileManager.doCompile(this.request, this.callback)
      })

      return it('should inject the draft mode header', function () {
        return this.DraftModeManager.injectDraftMode
          .calledWith(this.compileDir + '/' + this.rootResourcePath)
          .should.equal(true)
      })
    })

    describe('with a check option', function () {
      beforeEach(function () {
        this.request.check = 'error'
        return this.CompileManager.doCompile(this.request, this.callback)
      })

      return it('should run chktex', function () {
        return this.LatexRunner.runLatex
          .calledWith(`${this.project_id}-${this.user_id}`, {
            directory: this.compileDir,
            mainFile: this.rootResourcePath,
            compiler: this.compiler,
            timeout: this.timeout,
            image: this.image,
            flags: this.flags,
            environment: {
              CHKTEX_OPTIONS: '-nall -e9 -e10 -w15 -w16',
              CHKTEX_EXIT_ON_ERROR: 1,
              CHKTEX_ULIMIT_OPTIONS: '-t 5 -v 64000'
            },
            compileGroup: this.compileGroup
          })
          .should.equal(true)
      })
    })

    return describe('with a knitr file and check options', function () {
      beforeEach(function () {
        this.request.rootResourcePath = 'main.Rtex'
        this.request.check = 'error'
        return this.CompileManager.doCompile(this.request, this.callback)
      })

      return it('should not run chktex', function () {
        return this.LatexRunner.runLatex
          .calledWith(`${this.project_id}-${this.user_id}`, {
            directory: this.compileDir,
            mainFile: 'main.Rtex',
            compiler: this.compiler,
            timeout: this.timeout,
            image: this.image,
            flags: this.flags,
            environment: this.env,
            compileGroup: this.compileGroup
          })
          .should.equal(true)
      })
    })
  })

  describe('clearProject', function () {
    describe('succesfully', function () {
      beforeEach(function () {
        this.Settings.compileDir = 'compiles'
        this.fs.lstat = sinon.stub().callsArgWith(1, null, {
          isDirectory() {
            return true
          }
        })
        this.proc = new EventEmitter()
        this.proc.stdout = new EventEmitter()
        this.proc.stderr = new EventEmitter()
        this.proc.stderr.setEncoding = sinon.stub().returns(this.proc.stderr)
        this.child_process.spawn = sinon.stub().returns(this.proc)
        this.CompileManager.clearProject(
          this.project_id,
          this.user_id,
          this.callback
        )
        return this.proc.emit('close', 0)
      })

      it('should remove the project directory', function () {
        return this.child_process.spawn
          .calledWith('rm', [
            '-r',
            '-f',
            '--',
            `${this.Settings.path.compilesDir}/${this.project_id}-${this.user_id}`,
            `${this.Settings.path.outputDir}/${this.project_id}-${this.user_id}`
          ])
          .should.equal(true)
      })

      return it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
    })

    return describe('with a non-success status code', function () {
      beforeEach(function () {
        this.Settings.compileDir = 'compiles'
        this.fs.lstat = sinon.stub().callsArgWith(1, null, {
          isDirectory() {
            return true
          }
        })
        this.proc = new EventEmitter()
        this.proc.stdout = new EventEmitter()
        this.proc.stderr = new EventEmitter()
        this.proc.stderr.setEncoding = sinon.stub().returns(this.proc.stderr)
        this.child_process.spawn = sinon.stub().returns(this.proc)
        this.CompileManager.clearProject(
          this.project_id,
          this.user_id,
          this.callback
        )
        this.proc.stderr.emit('data', (this.error = 'oops'))
        return this.proc.emit('close', 1)
      })

      it('should remove the project directory', function () {
        return this.child_process.spawn
          .calledWith('rm', [
            '-r',
            '-f',
            '--',
            `${this.Settings.path.compilesDir}/${this.project_id}-${this.user_id}`,
            `${this.Settings.path.outputDir}/${this.project_id}-${this.user_id}`
          ])
          .should.equal(true)
      })

      it('should call the callback with an error from the stderr', function () {
        this.callback.calledWithExactly(sinon.match(Error)).should.equal(true)

        this.callback.args[0][0].message.should.equal(
          `rm -r ${this.Settings.path.compilesDir}/${this.project_id}-${this.user_id} ${this.Settings.path.outputDir}/${this.project_id}-${this.user_id} failed: ${this.error}`
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
      this.file_name = 'main.tex'
      this.child_process.execFile = sinon.stub()
      return (this.Settings.path.synctexBaseDir = (project_id) =>
        `${this.Settings.path.compilesDir}/${this.project_id}-${this.user_id}`)
    })

    describe('syncFromCode', function () {
      beforeEach(function () {
        this.fs.stat = sinon.stub().callsArgWith(1, null, {
          isFile() {
            return true
          }
        })
        this.stdout = `NODE\t${this.page}\t${this.h}\t${this.v}\t${this.width}\t${this.height}\n`
        this.CommandRunner.run = sinon
          .stub()
          .callsArgWith(7, null, { stdout: this.stdout })
        return this.CompileManager.syncFromCode(
          this.project_id,
          this.user_id,
          this.file_name,
          this.line,
          this.column,
          this.callback
        )
      })

      it('should execute the synctex binary', function () {
        const bin_path = Path.resolve(__dirname + '/../../../bin/synctex')
        const synctex_path = `${this.Settings.path.compilesDir}/${this.project_id}-${this.user_id}/output.pdf`
        const file_path = `${this.Settings.path.compilesDir}/${this.project_id}-${this.user_id}/${this.file_name}`
        return this.CommandRunner.run
          .calledWith(
            `${this.project_id}-${this.user_id}`,
            [
              '/opt/synctex',
              'code',
              synctex_path,
              file_path,
              this.line,
              this.column
            ],
            `${this.Settings.path.compilesDir}/${this.project_id}-${this.user_id}`,
            this.Settings.clsi.docker.image,
            60000,
            {}
          )
          .should.equal(true)
      })

      return it('should call the callback with the parsed output', function () {
        return this.callback
          .calledWith(null, [
            {
              page: this.page,
              h: this.h,
              v: this.v,
              height: this.height,
              width: this.width
            }
          ])
          .should.equal(true)
      })
    })

    return describe('syncFromPdf', function () {
      beforeEach(function () {
        this.fs.stat = sinon.stub().callsArgWith(1, null, {
          isFile() {
            return true
          }
        })
        this.stdout = `NODE\t${this.Settings.path.compilesDir}/${this.project_id}-${this.user_id}/${this.file_name}\t${this.line}\t${this.column}\n`
        this.CommandRunner.run = sinon
          .stub()
          .callsArgWith(7, null, { stdout: this.stdout })
        return this.CompileManager.syncFromPdf(
          this.project_id,
          this.user_id,
          this.page,
          this.h,
          this.v,
          this.callback
        )
      })

      it('should execute the synctex binary', function () {
        const bin_path = Path.resolve(__dirname + '/../../../bin/synctex')
        const synctex_path = `${this.Settings.path.compilesDir}/${this.project_id}-${this.user_id}/output.pdf`
        return this.CommandRunner.run
          .calledWith(
            `${this.project_id}-${this.user_id}`,
            ['/opt/synctex', 'pdf', synctex_path, this.page, this.h, this.v],
            `${this.Settings.path.compilesDir}/${this.project_id}-${this.user_id}`,
            this.Settings.clsi.docker.image,
            60000,
            {}
          )
          .should.equal(true)
      })

      return it('should call the callback with the parsed output', function () {
        return this.callback
          .calledWith(null, [
            {
              file: this.file_name,
              line: this.line,
              column: this.column
            }
          ])
          .should.equal(true)
      })
    })
  })

  return describe('wordcount', function () {
    beforeEach(function () {
      this.CommandRunner.run = sinon.stub().callsArg(7)
      this.fs.readFile = sinon
        .stub()
        .callsArgWith(
          2,
          null,
          (this.stdout = 'Encoding: ascii\nWords in text: 2')
        )
      this.callback = sinon.stub()

      this.project_id
      this.timeout = 60 * 1000
      this.file_name = 'main.tex'
      this.Settings.path.compilesDir = '/local/compile/directory'
      this.image = 'example.com/image'

      return this.CompileManager.wordcount(
        this.project_id,
        this.user_id,
        this.file_name,
        this.image,
        this.callback
      )
    })

    it('should run the texcount command', function () {
      this.directory = `${this.Settings.path.compilesDir}/${this.project_id}-${this.user_id}`
      this.file_path = `$COMPILE_DIR/${this.file_name}`
      this.command = [
        'texcount',
        '-nocol',
        '-inc',
        this.file_path,
        `-out=${this.file_path}.wc`
      ]

      return this.CommandRunner.run
        .calledWith(
          `${this.project_id}-${this.user_id}`,
          this.command,
          this.directory,
          this.image,
          this.timeout,
          {}
        )
        .should.equal(true)
    })

    return it('should call the callback with the parsed output', function () {
      return this.callback
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
          messages: ''
        })
        .should.equal(true)
    })
  })
})
