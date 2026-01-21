import Client from './helpers/Client.js'
import ClsiApp from './helpers/ClsiApp.js'
import { expect } from 'chai'

describe('Smoke Test', function () {
  before(async function () {
    await ClsiApp.ensureRunning()
  })

  it('should compile the test document and return a response of "OK"', async function () {
    const response = await Client.smokeTest()
    expect(response).to.equal('OK')
  })
})
