const Client = require('./helpers/Client')
const ClsiApp = require('./helpers/ClsiApp')
const { expect } = require('chai')

describe('Smoke Test', function () {
  before(async function () {
    await ClsiApp.ensureRunning()
  })

  it('should compile the test document and return a response of "OK"', async function () {
    const response = await Client.smokeTest()
    expect(response).to.equal('OK')
  })
})
