const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const fs = require('node:fs')
const path = require('node:path')

const MODULE_PATH = require('node:path').join(
  __dirname,
  '../../../app/js/LatexRunner'
)

describe('LatexRunner', function () {
  beforeEach(function () {
    this.Settings = {
      docker: {
        socketPath: '/var/run/docker.sock',
      },
    }
    this.commandRunnerOutput = {
      stdout: 'this is stdout',
      stderr: 'this is stderr',
    }
    this.CommandRunner = {
      run: sinon.stub().yields(null, this.commandRunnerOutput),
    }
    this.fs = {
      writeFile: sinon.stub().yields(),
      unlink: sinon
        .stub()
        .yields(new Error('ENOENT: no such file or directory, unlink ...')),
    }
    this.LatexRunner = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@overleaf/settings': this.Settings,
        './CommandRunner': this.CommandRunner,
        fs: this.fs,
      },
    })

    this.directory = '/local/compile/directory'
    this.mainFile = 'main-file.tex'
    this.compiler = 'pdflatex'
    this.image = 'example.com/image'
    this.compileGroup = 'compile-group'
    this.callback = sinon.stub()
    this.project_id = 'project-id-123'
    this.env = { foo: '123' }
    this.timeout = 42000
    this.flags = []
    this.stopOnFirstError = false
    this.stats = {}
    this.timings = {}

    this.call = function (callback) {
      this.LatexRunner.runLatex(
        this.project_id,
        {
          directory: this.directory,
          mainFile: this.mainFile,
          compiler: this.compiler,
          timeout: this.timeout,
          image: this.image,
          environment: this.env,
          compileGroup: this.compileGroup,
          flags: this.flags,
          stopOnFirstError: this.stopOnFirstError,
          timings: this.timings,
          stats: this.stats,
        },
        callback
      )
    }
  })

  describe('runLatex', function () {
    describe('normally', function () {
      beforeEach(function (done) {
        this.call(done)
      })

      it('should run the latex command', function () {
        this.CommandRunner.run.should.have.been.calledWith(
          this.project_id,
          [
            'latexmk',
            '-cd',
            '-jobname=output',
            '-auxdir=$COMPILE_DIR',
            '-outdir=$COMPILE_DIR',
            '-synctex=1',
            '-interaction=batchmode',
            '-time',
            '-f',
            '-pdf',
            '$COMPILE_DIR/main-file.tex',
          ],
          this.directory,
          this.image,
          this.timeout,
          this.env,
          this.compileGroup
        )
      })

      it('should record the stdout and stderr', function () {
        this.fs.writeFile.should.have.been.calledWith(
          this.directory + '/' + 'output.stdout',
          'this is stdout',
          { flag: 'wx' }
        )
        this.fs.writeFile.should.have.been.calledWith(
          this.directory + '/' + 'output.stderr',
          'this is stderr',
          { flag: 'wx' }
        )
        this.fs.unlink.should.have.been.calledWith(
          this.directory + '/' + 'output.stdout'
        )
        this.fs.unlink.should.have.been.calledWith(
          this.directory + '/' + 'output.stderr'
        )
      })

      it('should not record cpu metrics', function () {
        expect(this.timings['cpu-percent']).to.not.exist
        expect(this.timings['cpu-time']).to.not.exist
        expect(this.timings['sys-time']).to.not.exist
      })
    })

    describe('with a different compiler', function () {
      beforeEach(function (done) {
        this.compiler = 'lualatex'
        this.call(done)
      })

      it('should set the appropriate latexmk flag', function () {
        this.CommandRunner.run.should.have.been.calledWith(this.project_id, [
          'latexmk',
          '-cd',
          '-jobname=output',
          '-auxdir=$COMPILE_DIR',
          '-outdir=$COMPILE_DIR',
          '-synctex=1',
          '-interaction=batchmode',
          '-time',
          '-f',
          '-lualatex',
          '$COMPILE_DIR/main-file.tex',
        ])
      })
    })

    describe('with time -v', function () {
      beforeEach(function (done) {
        this.commandRunnerOutput.stderr =
          '\tCommand being timed: "sh -c timeout 1 yes > /dev/null"\n' +
          '\tUser time (seconds): 0.28\n' +
          '\tSystem time (seconds): 0.70\n' +
          '\tPercent of CPU this job got: 98%\n'
        this.call(done)
      })

      it('should record cpu metrics', function () {
        expect(this.timings['cpu-percent']).to.equal(98)
        expect(this.timings['cpu-time']).to.equal(0.28)
        expect(this.timings['sys-time']).to.equal(0.7)
      })
    })

    describe('with an .Rtex main file', function () {
      beforeEach(function (done) {
        this.mainFile = 'main-file.Rtex'
        this.call(done)
      })

      it('should run the latex command on the equivalent .tex file', function () {
        const command = this.CommandRunner.run.args[0][1]
        const mainFile = command.slice(-1)[0]
        mainFile.should.equal('$COMPILE_DIR/main-file.tex')
      })
    })

    describe('with a flags option', function () {
      beforeEach(function (done) {
        this.flags = ['-shell-restricted', '-halt-on-error']
        this.call(done)
      })

      it('should include the flags in the command', function () {
        const command = this.CommandRunner.run.args[0][1]
        const flags = command.filter(
          arg => arg === '-shell-restricted' || arg === '-halt-on-error'
        )
        flags.length.should.equal(2)
        flags[0].should.equal('-shell-restricted')
        flags[1].should.equal('-halt-on-error')
      })
    })

    describe('with the stopOnFirstError option', function () {
      beforeEach(function (done) {
        this.stopOnFirstError = true
        this.call(done)
      })

      it('should set the appropriate flags', function () {
        this.CommandRunner.run.should.have.been.calledWith(this.project_id, [
          'latexmk',
          '-cd',
          '-jobname=output',
          '-auxdir=$COMPILE_DIR',
          '-outdir=$COMPILE_DIR',
          '-synctex=1',
          '-interaction=batchmode',
          '-time',
          '-halt-on-error',
          '-pdf',
          '$COMPILE_DIR/main-file.tex',
        ])
      })
    })

    describe('with old latexmk timing output', function () {
      beforeEach(function (done) {
        this.commandRunnerOutput.stdout = fs.readFileSync(
          path.join(__dirname, 'fixtures', 'latexmk1.txt'),
          'utf-8'
        )
        // pass in the `latexmk` property to signal that we want to receive parsed stats
        this.stats.latexmk = {}
        this.call(done)
      })

      it('should parse latexmk 4.52c (2017) timing information', function () {
        expect(this.stats.latexmk).to.deep.equal({
          'latexmk-rule-times': [
            { rule: 'makeindex', time_ms: 30 },
            { rule: 'bibtex', time_ms: 40 },
            { rule: 'latex', time_ms: 690 },
            { rule: 'makeindex', time_ms: 40 },
            { rule: 'bibtex', time_ms: 39 },
            { rule: 'latex', time_ms: 750 },
            { rule: 'makeindex', time_ms: 39 },
            { rule: 'bibtex', time_ms: 20 },
            { rule: 'latex', time_ms: 770 },
          ],
          'latexmk-rule-signature':
            'makeindex,bibtex,latex,makeindex,bibtex,latex,makeindex,bibtex,latex',
          'latexmk-rules-run': 9,
          'latexmk-time': { total: 2930 },
          'latexmk-img-times': [],
        })
      })
    })

    describe('with modern latexmk timing output', function () {
      beforeEach(function (done) {
        this.commandRunnerOutput.stdout = fs.readFileSync(
          path.join(__dirname, 'fixtures', 'latexmk2.txt'),
          'utf-8'
        )
        // pass in the `latexmk` property to signal that we want to receive parsed stats
        this.stats.latexmk = {}
        this.call(done)
      })

      it('should parse latexmk 4.83 (2024) timing information', function () {
        expect(this.stats.latexmk).to.deep.equal({
          'latexmk-rule-times': [
            { rule: 'latex', time_ms: 1880 },
            { rule: 'makeindex', time_ms: 50 },
            { rule: 'bibtex', time_ms: 50 },
            { rule: 'latex', time_ms: 2180 },
          ],
          'latexmk-rule-signature': 'latex,makeindex,bibtex,latex',
          'latexmk-time': {
            total: 4770,
            invoked: 4160,
            other: 610,
          },
          'latexmk-clock-time': 4870,
          'latexmk-rules-run': 4,
          'latexmk-img-times': [],
        })
      })
    })
  })
})
