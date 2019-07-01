'use strict'

var errorType = require('..')
const { expectError } = require('./support')

describe('errorType', function () {
  it('defines a custom error type', function () {
    var CustomError = errorType.define('CustomError')

    function doSomethingBad () {
      throw new CustomError()
    }

    try {
      doSomethingBad()
      expect.fail('should have thrown')
    } catch (e) {
      expectError(e, {
        name: 'CustomError',
        klass: CustomError,
        message: 'CustomError',
        firstFrameRx: /doSomethingBad/
      })
    }
  })

  it('defines a custom error type with a message', function () {
    var CustomError = errorType.define('CustomError', function (x) {
      this.message = 'x=' + x
      this.x = x
    })

    function doSomethingBad () {
      throw new CustomError('foo')
    }

    try {
      doSomethingBad()
      expect.fail('should have thrown')
    } catch (e) {
      expect(e.toString()).to.equal('CustomError: x=foo')
      expect(e.message).to.equal('x=foo')
      expect(e.x).to.equal('foo')
    }
  })

  it('defines extended error type', function () {
    var BaseError = errorType.define('BaseError')
    var DerivedError = errorType.extend(BaseError, 'DerivedError')

    function doSomethingBad () {
      throw new DerivedError()
    }

    try {
      doSomethingBad()
      expect.fail('should have thrown')
    } catch (e) {
      expect(e.toString()).to.equal('DerivedError')
    }
  })

  it('defines error types in a container object', function () {
    var SomeClass = {}
    errorType.defineIn(SomeClass, 'CustomError')

    function doSomethingBad () {
      throw new SomeClass.CustomError()
    }

    try {
      doSomethingBad()
      expect.fail('should have thrown')
    } catch (e) {
      expect(e.toString()).to.equal('CustomError')
    }
  })

  it('extends error types in a container object', function () {
    var SomeClass = {}
    errorType.defineIn(SomeClass, 'CustomError', function (payload) {
      this.message = 'custom error'
      this.payload = payload
    })
    errorType.extendIn(SomeClass, SomeClass.CustomError, 'DerivedCustomError',
      function (payload) {
        SomeClass.CustomError.call(this, payload)
        this.message = 'derived custom error'
      })

    function doSomethingBad () {
      throw new SomeClass.CustomError(123)
    }

    try {
      doSomethingBad()
      expect.fail('should have thrown')
    } catch (e) {
      expect(e.toString()).to.equal('CustomError: custom error')
      expect(e.payload).to.equal(123)
    }

    function doSomethingBadWithDerived () {
      throw new SomeClass.DerivedCustomError(456)
    }

    try {
      doSomethingBadWithDerived()
      expect.fail('should have thrown')
    } catch (e) {
      expect(e.toString()).to.equal('DerivedCustomError: derived custom error')
      expect(e.payload).to.equal(456)
    }
  })
})
