import sinon from 'sinon'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Errors from '../../../app/js/Errors.js'

const { FailedCommandError } = Errors

const modulePath = '../../../app/js/ImageOptimiser.js'

describe('ImageOptimiser', function () {
  let ImageOptimiser, SafeExec
  const sourcePath = '/wombat/potato.eps'

  beforeEach(async function () {
    SafeExec = {
      promises: sinon.stub().resolves(),
    }

    vi.doMock('../../../app/js/SafeExec', () => ({
      default: SafeExec,
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: {
        Timer: sinon.stub().returns({ done: sinon.stub() }),
      },
    }))

    ImageOptimiser = (await import(modulePath)).default
  })

  describe('compressPng', function () {
    it('should convert the file', async function () {
      await new Promise(resolve => {
        ImageOptimiser.compressPng(sourcePath, err => {
          expect(err).not.to.exist
          expect(SafeExec.promises).to.have.been.calledWith([
            'optipng',
            sourcePath,
          ])
          resolve()
        })
      })
    })

    it('should return the error', async function () {
      await new Promise(resolve => {
        SafeExec.promises.rejects('wombat herding failure')
        ImageOptimiser.compressPng(sourcePath, err => {
          expect(err.toString()).to.equal('wombat herding failure')
          resolve()
        })
      })
    })
  })

  describe('when optimiser is sigkilled', function () {
    const expectedError = new FailedCommandError('', 'SIGKILL', '', '')
    let error

    beforeEach(async function () {
      await new Promise(resolve => {
        SafeExec.promises.rejects(expectedError)
        ImageOptimiser.compressPng(sourcePath, err => {
          error = err
          resolve()
        })
      })
    })

    it('should not produce an error', function () {
      expect(error).not.to.exist
    })

    it('should log a warning', function (ctx) {
      expect(ctx.logger.warn).to.have.been.calledOnce
    })
  })
})
