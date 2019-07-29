const OError = require('..')
const HttpErrors = require('../http')

describe('OError/http', () => {
  it('is instance of OError', () => {
    try {
      throw new HttpErrors.ConflictError()
    } catch (e) {
      expect(e).to.be.instanceof(OError)
    }
  })

  it('has status code', () => {
    try {
      throw new HttpErrors.ConflictError()
    } catch (e) {
      expect(e.statusCode).to.equal(409)
    }
  })
})
