/* eslint-disable
    handle-callback-err,
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
  '../../../app/js/OutputFileFinder'
)
const path = require('path')
const { expect } = require('chai')
const { EventEmitter } = require('events')

describe('OutputFileFinder', function() {
  beforeEach(function() {
    this.OutputFileFinder = SandboxedModule.require(modulePath, {
      requires: {
        fs: (this.fs = {}),
        child_process: { spawn: (this.spawn = sinon.stub()) },
        'logger-sharelatex': { log: sinon.stub(), warn: sinon.stub() }
      }
    })
    this.directory = '/test/dir'
    return (this.callback = sinon.stub())
  })

  describe('findOutputFiles', function() {
    beforeEach(function() {
      this.resource_path = 'resource/path.tex'
      this.output_paths = ['output.pdf', 'extra/file.tex']
      this.all_paths = this.output_paths.concat([this.resource_path])
      this.resources = [{ path: (this.resource_path = 'resource/path.tex') }]
      this.OutputFileFinder._getAllFiles = sinon
        .stub()
        .callsArgWith(1, null, this.all_paths)
      return this.OutputFileFinder.findOutputFiles(
        this.resources,
        this.directory,
        (error, outputFiles) => {
          this.outputFiles = outputFiles
        }
      )
    })

    return it('should only return the output files, not directories or resource paths', function() {
      return expect(this.outputFiles).to.deep.equal([
        {
          path: 'output.pdf',
          type: 'pdf'
        },
        {
          path: 'extra/file.tex',
          type: 'tex'
        }
      ])
    })
  })

  return describe('_getAllFiles', function() {
    beforeEach(function() {
      this.proc = new EventEmitter()
      this.proc.stdout = new EventEmitter()
      this.spawn.returns(this.proc)
      this.directory = '/base/dir'
      return this.OutputFileFinder._getAllFiles(this.directory, this.callback)
    })

    describe('successfully', function() {
      beforeEach(function() {
        this.proc.stdout.emit(
          'data',
          ['/base/dir/main.tex', '/base/dir/chapters/chapter1.tex'].join('\n') +
            '\n'
        )
        return this.proc.emit('close', 0)
      })

      return it('should call the callback with the relative file paths', function() {
        return this.callback
          .calledWith(null, ['main.tex', 'chapters/chapter1.tex'])
          .should.equal(true)
      })
    })

    return describe("when the directory doesn't exist", function() {
      beforeEach(function() {
        return this.proc.emit('close', 1)
      })

      return it('should call the callback with a blank array', function() {
        return this.callback.calledWith(null, []).should.equal(true)
      })
    })
  })
})
