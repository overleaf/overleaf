'use strict'

var errorType = require('..')

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
      // should set the name to the error's name
      expect(e.name).to.equal('CustomError')

      // should be an instance of the error type
      expect(e instanceof CustomError).to.be.true

      // should be an instance of the built-in Error type
      expect(e instanceof Error).to.be.true

      // should be recognised by util.isError
      expect(require('util').isError(e)).to.be.true

      // should have a stack trace
      expect(e.stack).to.be.truthy

      // toString should return the default error message formatting
      expect(e.toString()).to.equal('CustomError')

      // stack should start with the default error message formatting
      expect(e.stack.split('\n')[0], 'CustomError')

      // first stack frame should be the function where the error was thrown
      expect(e.stack.split('\n')[1]).to.match(/doSomethingBad/)
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
