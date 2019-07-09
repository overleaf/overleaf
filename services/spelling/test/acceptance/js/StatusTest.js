const { expect } = require('chai')
const request = require('./helpers/request')

describe('/status', () => {
  it('should return 200', async () => {
    const response = await request.get('/health_check')
    expect(response.statusCode).to.equal(200)
  })
})
