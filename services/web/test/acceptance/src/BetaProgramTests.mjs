import { expect } from 'chai'
import UserHelper from '../src/helpers/UserHelper.mjs'

describe('BetaProgram', function () {
  let email, userHelper
  beforeEach(async function () {
    userHelper = new UserHelper()
    email = userHelper.getDefaultEmail()
    userHelper = await UserHelper.createUser({ email })
    userHelper = await UserHelper.loginUser({
      email,
      password: userHelper.getDefaultPassword(),
    })
  })
  it('should opt in', async function () {
    const response = await userHelper.fetch('/beta/opt-in', { method: 'POST' })
    expect(response.status).to.equal(302)
    expect(response.headers.get('location')).to.equal(
      UserHelper.url('/beta/participate').toString()
    )
    const user = (await UserHelper.getUser({ email })).user
    expect(user.betaProgram).to.equal(true)
  })
  it('should opt out', async function () {
    const response = await userHelper.fetch('/beta/opt-out', { method: 'POST' })
    expect(response.status).to.equal(302)
    expect(response.headers.get('location')).to.equal(
      UserHelper.url('/beta/participate').toString()
    )
    const user = (await UserHelper.getUser({ email })).user
    expect(user.betaProgram).to.equal(false)
  })
})
