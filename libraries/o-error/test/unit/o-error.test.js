const { expect } = require('chai')

const OError = require('../..')
const {
  expectError,
  expectFullStackWithoutStackFramesToEqual,
} = require('./support')

class CustomError1 extends OError {
  constructor() {
    super('failed to foo')
  }
}

class CustomError2 extends OError {
  constructor(customMessage) {
    super(customMessage || 'failed to bar')
  }
}

describe('OError', function () {
  it('can have an info object', function () {
    const err1 = new OError('foo', { foo: 1 })
    expect(err1.info).to.eql({ foo: 1 })

    const err2 = new OError('foo').withInfo({ foo: 2 })
    expect(err2.info).to.eql({ foo: 2 })
  })

  it('can have a cause', function () {
    const err1 = new OError('foo', { foo: 1 }, new Error('cause 1'))
    expect(err1.cause.message).to.equal('cause 1')

    const err2 = new OError('foo').withCause(new Error('cause 2'))
    expect(err2.cause.message).to.equal('cause 2')
  })

  it('accepts non-Error causes', function () {
    const err1 = new OError('foo', {}, 'not-an-error')
    expect(err1.cause).to.equal('not-an-error')

    const err2 = new OError('foo').withCause('not-an-error')
    expect(err2.cause).to.equal('not-an-error')
  })

  it('handles a custom error type with a cause', function () {
    function doSomethingBadInternally() {
      throw new Error('internal error')
    }

    function doSomethingBad() {
      try {
        doSomethingBadInternally()
      } catch (error) {
        throw new CustomError1().withCause(error)
      }
    }

    try {
      doSomethingBad()
      expect.fail('should have thrown')
    } catch (error) {
      expectError(error, {
        name: 'CustomError1',
        klass: CustomError1,
        message: 'CustomError1: failed to foo',
        firstFrameRx: /doSomethingBad/,
      })
      expect(OError.getFullInfo(error)).to.deep.equal({})
      expectFullStackWithoutStackFramesToEqual(error, [
        'CustomError1: failed to foo',
        'caused by:',
        '    Error: internal error',
      ])
    }
  })

  it('handles a custom error type with nested causes', function () {
    function doSomethingBadInternally() {
      throw new Error('internal error')
    }

    function doBar() {
      try {
        doSomethingBadInternally()
      } catch (error) {
        throw new CustomError2('failed to bar!').withCause(error)
      }
    }

    function doFoo() {
      try {
        doBar()
      } catch (error) {
        throw new CustomError1().withCause(error)
      }
    }

    try {
      doFoo()
      expect.fail('should have thrown')
    } catch (error) {
      expectError(error, {
        name: 'CustomError1',
        klass: CustomError1,
        message: 'CustomError1: failed to foo',
        firstFrameRx: /doFoo/,
      })
      expectFullStackWithoutStackFramesToEqual(error, [
        'CustomError1: failed to foo',
        'caused by:',
        '    CustomError2: failed to bar!',
        '    caused by:',
        '        Error: internal error',
      ])
      expect(OError.getFullInfo(error)).to.deep.equal({})
    }
  })
})
