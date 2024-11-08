/* eslint-disable
    no-return-assign,
    no-unused-vars,
    n/no-deprecated-api,
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
const modulePath = require('node:path').join(
  __dirname,
  '../../../app/js/OutputFileOptimiser'
)
const path = require('node:path')
const { expect } = require('chai')
const { EventEmitter } = require('node:events')

describe('OutputFileOptimiser', function () {
  beforeEach(function () {
    this.OutputFileOptimiser = SandboxedModule.require(modulePath, {
      requires: {
        fs: (this.fs = {}),
        path: (this.Path = {}),
        child_process: { spawn: (this.spawn = sinon.stub()) },
        './Metrics': {},
      },
      globals: { Math }, // used by lodash
    })
    this.directory = '/test/dir'
    return (this.callback = sinon.stub())
  })

  describe('optimiseFile', function () {
    beforeEach(function () {
      this.src = './output.pdf'
      return (this.dst = './output.pdf')
    })

    describe('when the file is not a pdf file', function () {
      beforeEach(function (done) {
        this.src = './output.log'
        this.OutputFileOptimiser.checkIfPDFIsOptimised = sinon
          .stub()
          .callsArgWith(1, null, false)
        this.OutputFileOptimiser.optimisePDF = sinon
          .stub()
          .callsArgWith(2, null)
        return this.OutputFileOptimiser.optimiseFile(this.src, this.dst, done)
      })

      it('should not check if the file is optimised', function () {
        return this.OutputFileOptimiser.checkIfPDFIsOptimised
          .calledWith(this.src)
          .should.equal(false)
      })

      return it('should not optimise the file', function () {
        return this.OutputFileOptimiser.optimisePDF
          .calledWith(this.src, this.dst)
          .should.equal(false)
      })
    })

    describe('when the pdf file is not optimised', function () {
      beforeEach(function (done) {
        this.OutputFileOptimiser.checkIfPDFIsOptimised = sinon
          .stub()
          .callsArgWith(1, null, false)
        this.OutputFileOptimiser.optimisePDF = sinon
          .stub()
          .callsArgWith(2, null)
        return this.OutputFileOptimiser.optimiseFile(this.src, this.dst, done)
      })

      it('should check if the pdf is optimised', function () {
        return this.OutputFileOptimiser.checkIfPDFIsOptimised
          .calledWith(this.src)
          .should.equal(true)
      })

      return it('should optimise the pdf', function () {
        return this.OutputFileOptimiser.optimisePDF
          .calledWith(this.src, this.dst)
          .should.equal(true)
      })
    })

    return describe('when the pdf file is optimised', function () {
      beforeEach(function (done) {
        this.OutputFileOptimiser.checkIfPDFIsOptimised = sinon
          .stub()
          .callsArgWith(1, null, true)
        this.OutputFileOptimiser.optimisePDF = sinon
          .stub()
          .callsArgWith(2, null)
        return this.OutputFileOptimiser.optimiseFile(this.src, this.dst, done)
      })

      it('should check if the pdf is optimised', function () {
        return this.OutputFileOptimiser.checkIfPDFIsOptimised
          .calledWith(this.src)
          .should.equal(true)
      })

      return it('should not optimise the pdf', function () {
        return this.OutputFileOptimiser.optimisePDF
          .calledWith(this.src, this.dst)
          .should.equal(false)
      })
    })
  })

  return describe('checkIfPDFISOptimised', function () {
    beforeEach(function () {
      this.callback = sinon.stub()
      this.fd = 1234
      this.fs.open = sinon.stub().yields(null, this.fd)
      this.fs.read = sinon
        .stub()
        .withArgs(this.fd)
        .yields(null, 100, Buffer.from('hello /Linearized 1'))
      this.fs.close = sinon.stub().withArgs(this.fd).yields(null)
      return this.OutputFileOptimiser.checkIfPDFIsOptimised(
        this.src,
        this.callback
      )
    })

    describe('for a linearised file', function () {
      beforeEach(function () {
        this.fs.read = sinon
          .stub()
          .withArgs(this.fd)
          .yields(null, 100, Buffer.from('hello /Linearized 1'))
        return this.OutputFileOptimiser.checkIfPDFIsOptimised(
          this.src,
          this.callback
        )
      })

      it('should open the file', function () {
        return this.fs.open.calledWith(this.src, 'r').should.equal(true)
      })

      it('should read the header', function () {
        return this.fs.read.calledWith(this.fd).should.equal(true)
      })

      it('should close the file', function () {
        return this.fs.close.calledWith(this.fd).should.equal(true)
      })

      return it('should call the callback with a true result', function () {
        return this.callback.calledWith(null, true).should.equal(true)
      })
    })

    return describe('for an unlinearised file', function () {
      beforeEach(function () {
        this.fs.read = sinon
          .stub()
          .withArgs(this.fd)
          .yields(null, 100, Buffer.from('hello not linearized 1'))
        return this.OutputFileOptimiser.checkIfPDFIsOptimised(
          this.src,
          this.callback
        )
      })

      it('should open the file', function () {
        return this.fs.open.calledWith(this.src, 'r').should.equal(true)
      })

      it('should read the header', function () {
        return this.fs.read.calledWith(this.fd).should.equal(true)
      })

      it('should close the file', function () {
        return this.fs.close.calledWith(this.fd).should.equal(true)
      })

      return it('should call the callback with a false result', function () {
        return this.callback.calledWith(null, false).should.equal(true)
      })
    })
  })
})
