const { expect } = require('chai')
const UserHelper = require('../src/helpers/UserHelper')

describe('BetaProgram', function () {
  let email, userHelper
  beforeEach(async function () {
    userHelper = new UserHelper()
    email = userHelper.getDefaultEmail()
    userHelper = await UserHelper.createUser({ email })
    userHelper = await UserHelper.loginUser({
      email,
      password: userHelper.getDefaultPassword()
    })
  })
  it('should opt in', async function () {
    const response = await userHelper.request.post('/beta/opt-in', {
      simple: false
    })
    expect(response.statusCode).to.equal(302)
    response.statusCode.should.equal(302)
    expect(response.headers.location).to.equal('/beta/participate')
    const user = (
      await UserHelper.getUser({
        email
      })
    ).user
    expect(user.betaProgram).to.equal(true)
  })
  it('should opt out', async function () {
    const response = await userHelper.request.post('/beta/opt-out', {
      simple: false
    })
    expect(response.statusCode).to.equal(302)
    response.statusCode.should.equal(302)
    expect(response.headers.location).to.equal('/beta/participate')
    const user = (
      await UserHelper.getUser({
        email
      })
    ).user
    expect(user.betaProgram).to.equal(false)
  })
})
