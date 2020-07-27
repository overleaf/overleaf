const { expect } = require('chai')
const cheerio = require('cheerio')
const UserHelper = require('../src/helpers/UserHelper')

describe('Bonus', function() {
  let userHelper
  beforeEach(async function() {
    userHelper = new UserHelper()
    const email = userHelper.getDefaultEmail()
    userHelper = await UserHelper.createUser({ email })
    userHelper = await UserHelper.loginUser({
      email,
      password: userHelper.getDefaultPassword()
    })
  })

  it('should use the count rather than refered_users', async function() {
    await UserHelper.updateUser(userHelper.user._id, {
      $set: { refered_user_count: 1, refered_users: [] }
    })

    const response = await userHelper.request.get('/user/bonus')
    expect(response.statusCode).to.equal(200)

    const dom = cheerio.load(response.body)
    expect(dom('.bonus-status').text()).to.match(/You've introduced 1 person/)
  })
})
