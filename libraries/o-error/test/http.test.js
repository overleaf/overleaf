const OError = require('..')
const HttpErrors = require('../http')

describe('OError/http', function () {
  it('is instance of OError', function () {
    try {
      throw new HttpErrors.ConflictError()
    } catch (e) {
      expect(e).to.be.instanceof(OError)
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
