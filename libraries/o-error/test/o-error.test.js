const OError = require('..')
const { expectError } = require('./support')

class CustomError1 extends OError {
  constructor(info) {
    super('failed to foo', info)
  }
}

class CustomError2 extends OError {
  constructor(customMessage, info) {
    super(customMessage || 'failed to bar', info)
  }
}

describe('OError', function () {
  it('handles a custom error type with a cause', function () {
    function doSomethingBadInternally() {
      throw new Error('internal error')
    }

    function doSomethingBad() {
      try {
        doSomethingBadInternally()
      } catch (err) {
        throw new CustomError1({ userId: 123 }).withCause(err)
      }
    }

    try {
      doSomethingBad()
      expect.fail('should have thrown')
    } catch (e) {
      expectError(e, {
        name: 'CustomError1',
        klass: CustomError1,
        message: 'CustomError1: failed to foo: internal error',
        firstFrameRx: /doSomethingBad/,
      })
      expect(OError.getFullInfo(e)).to.deep.equal({ userId: 123 })
      const fullStack = OError.getFullStack(e)
      expect(fullStack).to.match(
        /^CustomError1: failed to foo: internal error$/m
      )
      expect(fullStack).to.match(/^caused by: Error: internal error$/m)
    }
  })

  it('handles a custom error type with nested causes', function () {
    function doSomethingBadInternally() {
      throw new Error('internal error')
    }

    function doBar() {
      try {
        doSomethingBadInternally()
      } catch (err) {
        throw new CustomError2('failed to bar!', { inner: 'a' }).withCause(err)
      }
    }

    function doFoo() {
      try {
        doBar()
      } catch (err) {
        throw new CustomError1({ userId: 123 }).withCause(err)
      }
    }

    try {
      doFoo()
      expect.fail('should have thrown')
    } catch (e) {
      expectError(e, {
        name: 'CustomError1',
        klass: CustomError1,
        message: 'CustomError1: failed to foo: failed to bar!: internal error',
        firstFrameRx: /doFoo/,
      })
      expect(OError.getFullInfo(e)).to.deep.equal({
        userId: 123,
        inner: 'a',
      })
      const fullStack = OError.getFullStack(e)
      expect(fullStack).to.match(
        /^CustomError1: failed to foo: failed to bar!: internal error$/m
      )
      expect(fullStack).to.match(
        /^caused by: CustomError2: failed to bar!: internal error$/m
      )
      expect(fullStack).to.match(/^caused by: Error: internal error$/m)
    }
  })

  it('handles a custom error without info', function () {
    try {
      throw new CustomError1()
    } catch (e) {
      expect(OError.getFullInfo(e)).to.deep.equal({})
      const infoKey = Object.keys(e).find((k) => k === 'info')
      expect(infoKey).to.not.exist
    }
  })
})
