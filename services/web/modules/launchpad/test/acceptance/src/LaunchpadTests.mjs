import { expect } from 'chai'
import cheerio from 'cheerio'
import UserHelper from '../../../../../test/acceptance/src/helpers/UserHelper.mjs'

describe('Launchpad', function () {
  const adminEmail = 'admin@example.com'
  const adminPassword = 'adreadfulsecret'
  const user = new UserHelper()

  it('should show the launchpad page', async function () {
    const response = await user.fetch('/launchpad')
    expect(response.status).to.equal(200)
    const body = await response.text()
    const $ = cheerio.load(body)
    expect($('h2').first().text()).to.equal('Create the first Admin account')
    expect($('form[name="email"]').first()).to.exist
    expect($('form[name="password"]').first()).to.exist
  })

  it('should allow for creation of the first admin user', async function () {
    // Load the launchpad page
    const initialPageResponse = await user.fetch('/launchpad')
    expect(initialPageResponse.status).to.equal(200)
    const initialPageBody = await initialPageResponse.text()
    const $ = cheerio.load(initialPageBody)
    expect($('h2').first().text()).to.equal('Create the first Admin account')
    expect($('form[name="email"]').first()).to.exist
    expect($('form[name="password"]').first()).to.exist

    // Submit the form
    let csrfToken = await user.getCsrfToken()
    const postResponse = await user.fetch('/launchpad/register_admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        _csrf: csrfToken,
        email: adminEmail,
        password: adminPassword,
      }),
    })
    expect(postResponse.status).to.equal(200)
    const postBody = await postResponse.json()
    expect(postBody).to.deep.equal({ redir: '/launchpad' })

    // Try to load the page again
    const secondPageResponse = await user.fetch('/launchpad')
    expect(secondPageResponse.status).to.equal(302)
    expect(secondPageResponse.headers.get('location')).to.equal(
      UserHelper.url('/login').toString()
    )

    // Forbid submitting the form again
    csrfToken = await user.getCsrfToken()
    const badPostResponse = await user.fetch('/launchpad/register_admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        _csrf: csrfToken,
        email: adminEmail + '1',
        password: adminPassword + '1',
      }),
    })
    expect(badPostResponse.status).to.equal(403)

    // Log in as this new admin user
    const adminUser = await UserHelper.loginUser({
      email: adminEmail,
      password: adminPassword,
    })
    // Check we are actually admin
    expect(await adminUser.isLoggedIn()).to.equal(true)
    expect(adminUser.user.isAdmin).to.equal(true)

    // Check reversedHostName is stored
    expect(adminUser.user.emails[0].reversedHostname).to.equal('moc.elpmaxe')
  })
})
