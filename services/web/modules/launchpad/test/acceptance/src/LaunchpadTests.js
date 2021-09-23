const { expect } = require('chai')
const cheerio = require('cheerio')
const WEB_PATH = '../../../../..'
const UserHelper = require(`${WEB_PATH}/test/acceptance/src/helpers/UserHelper`)

describe('Launchpad', function () {
  const adminEmail = 'admin@example.com'
  const adminPassword = 'adreadfulsecret'
  const user = new UserHelper()

  it('should show the launchpad page', async function () {
    const response = await user.request.get('/launchpad')
    expect(response.statusCode).to.equal(200)
    const $ = cheerio.load(response.body)
    expect($('h2').first().text()).to.equal('Create the first Admin account')
    expect($('form[name="email"]').first()).to.exist
    expect($('form[name="password"]').first()).to.exist
  })

  it('should allow for creation of the first admin user', async function () {
    // Load the launchpad page
    const initialPageResponse = await user.request.get('/launchpad')
    expect(initialPageResponse.statusCode).to.equal(200)
    const $ = cheerio.load(initialPageResponse.body)
    expect($('h2').first().text()).to.equal('Create the first Admin account')
    expect($('form[name="email"]').first()).to.exist
    expect($('form[name="password"]').first()).to.exist

    // Submit the form
    let csrfToken = await user.getCsrfToken()
    const postResponse = await user.request.post({
      url: '/launchpad/register_admin',
      json: {
        _csrf: csrfToken,
        email: adminEmail,
        password: adminPassword,
      },
    })
    expect(postResponse.statusCode).to.equal(200)
    expect(postResponse.body).to.deep.equal({ redir: '/launchpad' })

    // Try to load the page again
    const secondPageResponse = await user.request.get('/launchpad', {
      simple: false,
    })
    expect(secondPageResponse.statusCode).to.equal(302)
    expect(secondPageResponse.headers.location).to.equal('/login')

    // Forbid submitting the form again
    csrfToken = await user.getCsrfToken()
    const badPostResponse = await user.request.post({
      url: '/launchpad/register_admin',
      json: {
        _csrf: csrfToken,
        email: adminEmail + '1',
        password: adminPassword + '1',
      },
      simple: false,
    })
    expect(badPostResponse.statusCode).to.equal(403)

    // Log in as this new admin user
    const adminUser = await UserHelper.loginUser({
      email: adminEmail,
      password: adminPassword,
    })
    // Check we are actually admin
    expect(await adminUser.isLoggedIn()).to.equal(true)
    expect(adminUser.user.isAdmin).to.equal(true)
  })
})
