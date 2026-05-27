import { describe, it, expect } from 'vitest'
import Errors from '../../../../app/src/Features/Errors/Errors.js'

describe('BackwardCompatibleError', function () {
  it('supports OError signature with info and cause', function () {
    const cause = new Error('root cause')
    const error = new Errors.BackwardCompatibleError(
      'message',
      { key: 'value' },
      cause
    )

    expect(error).to.be.instanceOf(Error)
    expect(error).to.be.instanceOf(Errors.BackwardCompatibleError)
    expect(error.message).to.equal('message')
    expect(error.info).to.eql({ key: 'value' })
    expect(error.cause).to.equal(cause)
  })

  it('supports object options signature including cause', function () {
    const cause = new Error('root cause')
    const error = new Errors.BackwardCompatibleError({
      message: 'message',
      info: { key: 'value' },
      cause,
    })

    expect(error.message).to.equal('message')
    expect(error.info).to.eql({ key: 'value' })
    expect(error.cause).to.equal(cause)
  })

  it('handles null message values', function () {
    const cause = new Error('root cause')
    const error = new Errors.BackwardCompatibleError(
      null,
      { key: 'value' },
      cause
    )

    expect(error.message).to.equal('')
    expect(error.info).to.eql({ key: 'value' })
    expect(error.cause).to.equal(cause)
  })
})
