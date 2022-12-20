import { expect } from 'chai'
import * as request from './helpers/request.js'

describe('/status', function () {
  it('should return 200', async function () {
    const response = await request.get('/health_check')
    expect(response.statusCode).to.equal(200)
  })
})
