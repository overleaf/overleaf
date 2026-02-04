import { vi, describe, beforeEach, it } from 'vitest'
import sinon from 'sinon'
import path from 'node:path'

const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/OutputFileOptimiser'
)

describe('OutputFileOptimiser', function () {
  beforeEach(async function (ctx) {
    vi.doMock('fs', () => ({
      default: (ctx.fs = {}),
    }))

    vi.doMock('path', () => ({
      default: (ctx.Path = {}),
    }))

    vi.doMock('child_process', () => ({
      default: { spawn: (ctx.spawn = sinon.stub()) },
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: {},
    }))

    ctx.OutputFileOptimiser = (await import(modulePath)).default
    ctx.directory = '/test/dir'
    return (ctx.callback = sinon.stub())
  })

  describe('optimiseFile', function () {
    beforeEach(function (ctx) {
      ctx.src = './output.pdf'
      return (ctx.dst = './output.pdf')
    })

    describe('when the file is not a pdf file', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.src = './output.log'
          ctx.OutputFileOptimiser.checkIfPDFIsOptimised = sinon
            .stub()
            .callsArgWith(1, null, false)
          ctx.OutputFileOptimiser.optimisePDF = sinon
            .stub()
            .callsArgWith(2, null)
          ctx.OutputFileOptimiser.optimiseFile(ctx.src, ctx.dst, err => {
            if (err) reject(err)
            resolve()
          })
        })
      })

      it('should not check if the file is optimised', function (ctx) {
        return ctx.OutputFileOptimiser.checkIfPDFIsOptimised
          .calledWith(ctx.src)
          .should.equal(false)
      })

      return it('should not optimise the file', function (ctx) {
        return ctx.OutputFileOptimiser.optimisePDF
          .calledWith(ctx.src, ctx.dst)
          .should.equal(false)
      })
    })

    describe('when the pdf file is not optimised', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.OutputFileOptimiser.checkIfPDFIsOptimised = sinon
            .stub()
            .callsArgWith(1, null, false)
          ctx.OutputFileOptimiser.optimisePDF = sinon
            .stub()
            .callsArgWith(2, null)
          ctx.OutputFileOptimiser.optimiseFile(ctx.src, ctx.dst, err => {
            if (err) reject(err)
            resolve()
          })
        })
      })

      it('should check if the pdf is optimised', function (ctx) {
        return ctx.OutputFileOptimiser.checkIfPDFIsOptimised
          .calledWith(ctx.src)
          .should.equal(true)
      })

      return it('should optimise the pdf', function (ctx) {
        return ctx.OutputFileOptimiser.optimisePDF
          .calledWith(ctx.src, ctx.dst)
          .should.equal(true)
      })
    })

    return describe('when the pdf file is optimised', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.OutputFileOptimiser.checkIfPDFIsOptimised = sinon
            .stub()
            .callsArgWith(1, null, true)
          ctx.OutputFileOptimiser.optimisePDF = sinon
            .stub()
            .callsArgWith(2, null)
          ctx.OutputFileOptimiser.optimiseFile(ctx.src, ctx.dst, err => {
            if (err) reject(err)
            resolve()
          })
        })
      })

      it('should check if the pdf is optimised', function (ctx) {
        ctx.OutputFileOptimiser.checkIfPDFIsOptimised
          .calledWith(ctx.src)
          .should.equal(true)
      })

      it('should not optimise the pdf', function (ctx) {
        ctx.OutputFileOptimiser.optimisePDF
          .calledWith(ctx.src, ctx.dst)
          .should.equal(false)
      })
    })
  })

  describe('checkIfPDFISOptimised', function () {
    beforeEach(function (ctx) {
      ctx.callback = sinon.stub()
      ctx.fd = 1234
      ctx.fs.open = sinon.stub().yields(null, ctx.fd)
      ctx.fs.read = sinon
        .stub()
        .withArgs(ctx.fd)
        .yields(null, 100, Buffer.from('hello /Linearized 1'))
      ctx.fs.close = sinon.stub().withArgs(ctx.fd).yields(null)
      ctx.OutputFileOptimiser.checkIfPDFIsOptimised(ctx.src, ctx.callback)
    })

    describe('for a linearised file', function () {
      beforeEach(function (ctx) {
        ctx.fs.read = sinon
          .stub()
          .withArgs(ctx.fd)
          .yields(null, 100, Buffer.from('hello /Linearized 1'))
        ctx.OutputFileOptimiser.checkIfPDFIsOptimised(ctx.src, ctx.callback)
      })

      it('should open the file', function (ctx) {
        ctx.fs.open.calledWith(ctx.src, 'r').should.equal(true)
      })

      it('should read the header', function (ctx) {
        ctx.fs.read.calledWith(ctx.fd).should.equal(true)
      })

      it('should close the file', function (ctx) {
        ctx.fs.close.calledWith(ctx.fd).should.equal(true)
      })

      it('should call the callback with a true result', function (ctx) {
        ctx.callback.calledWith(null, true).should.equal(true)
      })
    })

    describe('for an unlinearised file', function () {
      beforeEach(function (ctx) {
        ctx.fs.read = sinon
          .stub()
          .withArgs(ctx.fd)
          .yields(null, 100, Buffer.from('hello not linearized 1'))
        ctx.OutputFileOptimiser.checkIfPDFIsOptimised(ctx.src, ctx.callback)
      })

      it('should open the file', function (ctx) {
        ctx.fs.open.calledWith(ctx.src, 'r').should.equal(true)
      })

      it('should read the header', function (ctx) {
        ctx.fs.read.calledWith(ctx.fd).should.equal(true)
      })

      it('should close the file', function (ctx) {
        ctx.fs.close.calledWith(ctx.fd).should.equal(true)
      })

      it('should call the callback with a false result', function (ctx) {
        ctx.callback.calledWith(null, false).should.equal(true)
      })
    })
  })
})
