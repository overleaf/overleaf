const HttpErrors = require('../http')

const { expectError } = require('./support')

describe('OError/http', function () {
  it('is a valid OError', function () {
    function foo() {
      throw new HttpErrors.ConflictError()
    }

    try {
      foo()
    } catch (error) {
      expectError(error, {
        name: 'ConflictError',
        klass: HttpErrors.ConflictError,
        message: 'ConflictError: Conflict',
        firstFrameRx: /foo/,
      })
    }
  })

  it('has status code', function () {
    try {
      throw new HttpErrors.ConflictError()
    } catch (e) {
      expect(e.statusCode).to.equal(409)
    }
  })
})
