import { vi, expect, describe, beforeEach, it } from 'vitest'
import sinon from 'sinon'
import fs from 'node:fs'
import path from 'node:path'

const MODULE_PATH = path.join(
  import.meta.dirname,
  '../../../app/js/LatexRunner'
)

describe('LatexRunner', () => {
  beforeEach(async ctx => {
    ctx.Settings = {
      docker: {
        socketPath: '/var/run/docker.sock',
      },
    }
    ctx.commandRunnerOutput = {
      stdout: 'this is stdout',
      stderr: 'this is stderr',
    }
    ctx.CommandRunner = {
      run: sinon.stub().yields(null, ctx.commandRunnerOutput),
    }
    ctx.fs = {
      writeFile: sinon.stub().yields(),
      unlink: sinon
        .stub()
        .yields(new Error('ENOENT: no such file or directory, unlink ...')),
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock('../../../app/js/CommandRunner', () => ({
      default: ctx.CommandRunner,
    }))

    vi.doMock('fs', () => ({
      default: ctx.fs,
    }))

    ctx.LatexRunner = (await import(MODULE_PATH)).default

    ctx.directory = '/local/compile/directory'
    ctx.mainFile = 'main-file.tex'
    ctx.compiler = 'pdflatex'
    ctx.image = 'example.com/image'
    ctx.compileGroup = 'compile-group'
    ctx.callback = sinon.stub()
    ctx.project_id = 'project-id-123'
    ctx.env = { foo: '123' }
    ctx.timeout = 42000
    ctx.flags = []
    ctx.stopOnFirstError = false
    ctx.stats = {}
    ctx.timings = {}

    ctx.call = function (callback) {
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

  describe('runLatex', () => {
    describe('normally', () => {
      beforeEach(async ctx => {
        await new Promise((resolve, reject) => {
          ctx.call(err => {
            if (err) reject(err)
            resolve()
          })
        })
      })

      it('should run the latex command', ctx => {
        ctx.CommandRunner.run.should.have.been.calledWith(
          ctx.project_id,
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
          ctx.directory,
          ctx.image,
          ctx.timeout,
          ctx.env,
          ctx.compileGroup
        )
      })

      it('should record the stdout and stderr', ctx => {
        ctx.fs.writeFile.should.have.been.calledWith(
          ctx.directory + '/' + 'output.stdout',
          'this is stdout',
          { flag: 'wx' }
        )
        ctx.fs.writeFile.should.have.been.calledWith(
          ctx.directory + '/' + 'output.stderr',
          'this is stderr',
          { flag: 'wx' }
        )
        ctx.fs.unlink.should.have.been.calledWith(
          ctx.directory + '/' + 'output.stdout'
        )
        ctx.fs.unlink.should.have.been.calledWith(
          ctx.directory + '/' + 'output.stderr'
        )
      })

      it('should not record cpu metrics', ctx => {
        expect(ctx.timings['cpu-percent']).to.not.exist
        expect(ctx.timings['cpu-time']).to.not.exist
        expect(ctx.timings['sys-time']).to.not.exist
      })
    })

    describe('with a different compiler', () => {
      beforeEach(async ctx => {
        await new Promise((resolve, reject) => {
          ctx.compiler = 'lualatex'
          ctx.call(err => {
            if (err) reject(err)
            resolve()
          })
        })
      })

      it('should set the appropriate latexmk flag', ctx => {
        ctx.CommandRunner.run.should.have.been.calledWith(ctx.project_id, [
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

    describe('with time -v', () => {
      beforeEach(async ctx => {
        await new Promise((resolve, reject) => {
          ctx.commandRunnerOutput.stderr =
            '\tCommand being timed: "sh -c timeout 1 yes > /dev/null"\n' +
            '\tUser time (seconds): 0.28\n' +
            '\tSystem time (seconds): 0.70\n' +
            '\tPercent of CPU this job got: 98%\n'
          ctx.call(err => {
            if (err) reject(err)
            resolve()
          })
        })
      })

      it('should record cpu metrics', ctx => {
        expect(ctx.timings['cpu-percent']).to.equal(98)
        expect(ctx.timings['cpu-time']).to.equal(0.28)
        expect(ctx.timings['sys-time']).to.equal(0.7)
      })
    })

    describe('with an .Rtex main file', () => {
      beforeEach(async ctx => {
        await new Promise((resolve, reject) => {
          ctx.mainFile = 'main-file.Rtex'
          ctx.call(err => {
            if (err) reject(err)
            resolve()
          })
        })
      })

      it('should run the latex command on the equivalent .tex file', ctx => {
        const command = ctx.CommandRunner.run.args[0][1]
        const mainFile = command.slice(-1)[0]
        mainFile.should.equal('$COMPILE_DIR/main-file.tex')
      })
    })

    describe('with a flags option', () => {
      beforeEach(async ctx => {
        await new Promise((resolve, reject) => {
          ctx.flags = ['-shell-restricted', '-halt-on-error']
          ctx.call(err => {
            if (err) reject(err)
            resolve()
          })
        })
      })

      it('should include the flags in the command', ctx => {
        const command = ctx.CommandRunner.run.args[0][1]
        const flags = command.filter(
          arg => arg === '-shell-restricted' || arg === '-halt-on-error'
        )
        flags.length.should.equal(2)
        flags[0].should.equal('-shell-restricted')
        flags[1].should.equal('-halt-on-error')
      })
    })

    describe('with the stopOnFirstError option', () => {
      beforeEach(async ctx => {
        await new Promise((resolve, reject) => {
          ctx.stopOnFirstError = true
          ctx.call(err => {
            if (err) reject(err)
            resolve()
          })
        })
      })

      it('should set the appropriate flags', ctx => {
        ctx.CommandRunner.run.should.have.been.calledWith(ctx.project_id, [
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

    describe('with old latexmk timing output', () => {
      beforeEach(async ctx => {
        await new Promise((resolve, reject) => {
          ctx.commandRunnerOutput.stdout = fs.readFileSync(
            path.join(import.meta.dirname, 'fixtures', 'latexmk1.txt'),
            'utf-8'
          )
          // pass in the `latexmk` property to signal that we want to receive parsed stats
          ctx.stats.latexmk = {}
          ctx.call(err => {
            if (err) reject(err)
            resolve()
          })
        })
      })

      it('should parse latexmk 4.52c (2017) timing information', ctx => {
        expect(ctx.stats.latexmk).to.deep.equal({
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

    describe('with modern latexmk timing output', () => {
      beforeEach(async ctx => {
        await new Promise((resolve, reject) => {
          ctx.commandRunnerOutput.stdout = fs.readFileSync(
            path.join(import.meta.dirname, 'fixtures', 'latexmk2.txt'),
            'utf-8'
          )
          // pass in the `latexmk` property to signal that we want to receive parsed stats
          ctx.stats.latexmk = {}
          ctx.call(err => {
            if (err) reject(err)
            resolve()
          })
        })
      })

      it('should parse latexmk 4.83 (2024) timing information', ctx => {
        expect(ctx.stats.latexmk).to.deep.equal({
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
