import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'

const User = UserHelper.promises

describe('Home', function () {
  let user

  beforeEach(async function () {
    user = new User()
    await user.login()
  })

  describe('GET /', function () {
    it('should redirect a logged-in user to /project', async function () {
      const { response } = await user.doRequest('get', {
        url: '/',
        followRedirect: false,
      })
      expect(response.statusCode).to.equal(302)
      expect(response.headers.location).to.equal('/project')
    })
  })
})
