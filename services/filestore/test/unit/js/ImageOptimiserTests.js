const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const modulePath = '../../../app/js/ImageOptimiser.js'
const { FailedCommandError } = require('../../../app/js/Errors')
const SandboxedModule = require('sandboxed-module')

describe('ImageOptimiser', function() {
  let ImageOptimiser, SafeExec
  const sourcePath = '/wombat/potato.eps'

  beforeEach(function() {
    SafeExec = {
      promises: sinon.stub().resolves()
    }
    ImageOptimiser = SandboxedModule.require(modulePath, {
      requires: {
        './SafeExec': SafeExec,
        'logger-sharelatex': {
          log() {},
          err() {},
          warn() {}
        }
      }
    })
  })

  describe('compressPng', function() {
    it('should convert the file', function(done) {
      ImageOptimiser.compressPng(sourcePath, err => {
        expect(err).not.to.exist
        expect(SafeExec.promises).to.have.been.calledWith([
          'optipng',
          sourcePath
        ])
        done()
      })
    })

    it('should return the error', function(done) {
      SafeExec.promises.rejects('wombat herding failure')
      ImageOptimiser.compressPng(sourcePath, err => {
        expect(err.toString()).to.equal('wombat herding failure')
        done()
      })
    })
  })

  describe('when optimiser is sigkilled', function() {
    it('should not produce an error', function(done) {
      const error = new FailedCommandError('', 'SIGKILL', '', '')
      SafeExec.promises.rejects(error)
      ImageOptimiser.compressPng(sourcePath, err => {
        expect(err).not.to.exist
        done()
      })
    })
  })
})
