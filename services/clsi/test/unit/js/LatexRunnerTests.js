/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
require('chai').should()
const modulePath = require('path').join(
  __dirname,
  '../../../app/js/LatexRunner'
)
const Path = require('path')

describe('LatexRunner', function() {
  beforeEach(function() {
    let Timer
    this.LatexRunner = SandboxedModule.require(modulePath, {
      requires: {
        'settings-sharelatex': (this.Settings = {
          docker: {
            socketPath: '/var/run/docker.sock'
          }
        }),
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          error: sinon.stub()
        }),
        './Metrics': {
          Timer: (Timer = class Timer {
            done() {}
          })
        },
        './CommandRunner': (this.CommandRunner = {}),
        fs: (this.fs = {
          writeFile: sinon.stub().callsArg(2)
        })
      }
    })

    this.directory = '/local/compile/directory'
    this.mainFile = 'main-file.tex'
    this.compiler = 'pdflatex'
    this.image = 'example.com/image'
    this.compileGroup = 'compile-group'
    this.callback = sinon.stub()
    this.project_id = 'project-id-123'
    return (this.env = { foo: '123' })
  })

  return describe('runLatex', function() {
    beforeEach(function() {
      return (this.CommandRunner.run = sinon.stub().callsArgWith(7, null, {
        stdout: 'this is stdout',
        stderr: 'this is stderr'
      }))
    })

    describe('normally', function() {
      beforeEach(function() {
        return this.LatexRunner.runLatex(
          this.project_id,
          {
            directory: this.directory,
            mainFile: this.mainFile,
            compiler: this.compiler,
            timeout: (this.timeout = 42000),
            image: this.image,
            environment: this.env,
            compileGroup: this.compileGroup
          },
          this.callback
        )
      })

      it('should run the latex command', function() {
        return this.CommandRunner.run
          .calledWith(
            this.project_id,
            sinon.match.any,
            this.directory,
            this.image,
            this.timeout,
            this.env,
            this.compileGroup
          )
          .should.equal(true)
      })

      it('should record the stdout and stderr', function() {
        this.fs.writeFile
          .calledWith(this.directory + '/' + 'output.stdout', 'this is stdout')
          .should.equal(true)
        this.fs.writeFile
          .calledWith(this.directory + '/' + 'output.stderr', 'this is stderr')
          .should.equal(true)
      })
    })

    describe('with an .Rtex main file', function() {
      beforeEach(function() {
        return this.LatexRunner.runLatex(
          this.project_id,
          {
            directory: this.directory,
            mainFile: 'main-file.Rtex',
            compiler: this.compiler,
            image: this.image,
            timeout: (this.timeout = 42000)
          },
          this.callback
        )
      })

      return it('should run the latex command on the equivalent .tex file', function() {
        const command = this.CommandRunner.run.args[0][1]
        const mainFile = command.slice(-1)[0]
        return mainFile.should.equal('$COMPILE_DIR/main-file.tex')
      })
    })

    return describe('with a flags option', function() {
      beforeEach(function() {
        return this.LatexRunner.runLatex(
          this.project_id,
          {
            directory: this.directory,
            mainFile: this.mainFile,
            compiler: this.compiler,
            image: this.image,
            timeout: (this.timeout = 42000),
            flags: ['-file-line-error', '-halt-on-error']
          },
          this.callback
        )
      })

      return it('should include the flags in the command', function() {
        const command = this.CommandRunner.run.args[0][1]
        const flags = command.filter(
          arg => arg === '-file-line-error' || arg === '-halt-on-error'
        )
        flags.length.should.equal(2)
        flags[0].should.equal('-file-line-error')
        return flags[1].should.equal('-halt-on-error')
      })
    })
  })
})
