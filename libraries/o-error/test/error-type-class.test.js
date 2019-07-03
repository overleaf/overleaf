const errorType = require('..')
const { expectError } = require('./support')

class CustomError1 extends errorType.Error {
  constructor (options) {
    super({ message: 'failed to foo', ...options })
  }
}

class CustomError2 extends errorType.Error {
  constructor (options) {
    super({ message: 'failed to bar', ...options })
  }
}

describe('errorType.Error', () => {
  it('handles a custom error type with a cause', () => {
    function doSomethingBadInternally () {
      throw new Error('internal error')
    }

    function doSomethingBad () {
      try {
        doSomethingBadInternally()
      } catch (err) {
        throw new CustomError1({ info: { userId: 123 } }).withCause(err)
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
        firstFrameRx: /doSomethingBad/
      })
      expect(errorType.getFullInfo(e)).to.deep.equal({ userId: 123 })
      const fullStack = errorType.getFullStack(e)
      expect(fullStack).to.match(
        /^CustomError1: failed to foo: internal error$/m
      )
      expect(fullStack).to.match(
        /^caused by: Error: internal error$/m
      )
    }
  })

  it('handles a custom error type with nested causes', () => {
    function doSomethingBadInternally () {
      throw new Error('internal error')
    }

    function doBar () {
      try {
        doSomethingBadInternally()
      } catch (err) {
        throw new CustomError2({ info: { database: 'a' } }).withCause(err)
      }
    }

    function doFoo () {
      try {
        doBar()
      } catch (err) {
        throw new CustomError1({ info: { userId: 123 } }).withCause(err)
      }
    }

    try {
      doFoo()
      expect.fail('should have thrown')
    } catch (e) {
      expectError(e, {
        name: 'CustomError1',
        klass: CustomError1,
        message: 'CustomError1: failed to foo: failed to bar: internal error',
        firstFrameRx: /doFoo/
      })
      expect(errorType.getFullInfo(e)).to.deep.equal({
        userId: 123,
        database: 'a'
      })
      const fullStack = errorType.getFullStack(e)
      expect(fullStack).to.match(
        /^CustomError1: failed to foo: failed to bar: internal error$/m
      )
      expect(fullStack).to.match(
        /^caused by: CustomError2: failed to bar: internal error$/m
      )
      expect(fullStack).to.match(
        /^caused by: Error: internal error$/m
      )
    }
  })

  it('handles a custom error without info', () => {
    try {
      throw new CustomError1({})
      expect.fail('should have thrown')
    } catch (e) {
      expect(errorType.getFullInfo(e)).to.deep.equal({})
      let infoKey = Object.keys(e).find(k => k === 'info')
      expect(infoKey).to.not.exist
    }
  })
})

describe('errorType.ErrorWithStatusCode', () => {
  it('accepts a status code', () => {
    function findPage () {
      throw new errorType.ErrorWithStatusCode({
        message: 'page not found',
        info: { url: '/foo' },
        statusCode: 404
      })
    }

    try {
      findPage()
    } catch (e) {
      expectError(e, {
        name: 'ErrorWithStatusCode',
        klass: errorType.ErrorWithStatusCode,
        message: 'ErrorWithStatusCode: page not found',
        firstFrameRx: /findPage/
      })
      expect(e.statusCode).to.equal(404)
      expect(e.info).to.deep.equal({url: '/foo'})
    }
  })
})
