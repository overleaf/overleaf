const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const modulePath = '../../../app/js/ImageOptimiser.js'
const { FailedCommandError } = require('../../../app/js/Errors')
const SandboxedModule = require('sandboxed-module')

describe('ImageOptimiser', function () {
  let ImageOptimiser, SafeExec
  const sourcePath = '/wombat/potato.eps'

  beforeEach(function () {
    SafeExec = {
      promises: sinon.stub().resolves(),
    }
    ImageOptimiser = SandboxedModule.require(modulePath, {
      requires: {
        './SafeExec': SafeExec,
        '@overleaf/metrics': {
          Timer: sinon.stub().returns({ done: sinon.stub() }),
        },
      },
    })
  })

  describe('compressPng', function () {
    it('should convert the file', function (done) {
      ImageOptimiser.compressPng(sourcePath, err => {
        expect(err).not.to.exist
        expect(SafeExec.promises).to.have.been.calledWith([
          'optipng',
          sourcePath,
        ])
        done()
      })
    })

    it('should return the error', function (done) {
      SafeExec.promises.rejects('wombat herding failure')
      ImageOptimiser.compressPng(sourcePath, err => {
        expect(err.toString()).to.equal('wombat herding failure')
        done()
      })
    })
  })

  describe('when optimiser is sigkilled', function () {
    const expectedError = new FailedCommandError('', 'SIGKILL', '', '')
    let error

    beforeEach(function (done) {
      SafeExec.promises.rejects(expectedError)
      ImageOptimiser.compressPng(sourcePath, err => {
        error = err
        done()
      })
    })

    it('should not produce an error', function () {
      expect(error).not.to.exist
    })

    it('should log a warning', function () {
      expect(this.logger.warn).to.have.been.calledOnce
    })
  })
})
