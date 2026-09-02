import { expect } from 'chai'
import cheerio from 'cheerio'
import UserHelper from '../../../../../test/acceptance/src/helpers/UserHelper.mjs'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

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
    expect(await badPostResponse.json()).to.deep.equal({
      message: { type: 'error', text: 'admin user already exists' },
    })

    // Reject requests carrying a field the strict body schema doesn't know
    // about (schema validation runs before the admin-exists check, so this
    // is rejected regardless of whether an admin already exists)
    csrfToken = await user.getCsrfToken()
    const unknownFieldResponse = await user.fetch('/launchpad/register_admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        _csrf: csrfToken,
        email: adminEmail + '2',
        password: adminPassword + '2',
        notAField: 'nope',
      }),
    })
    const unknownFieldBody = await unknownFieldResponse.text()
    expectValidationErrorRaw(
      { statusCode: unknownFieldResponse.status, body: unknownFieldBody },
      400,
      'notAField'
    )

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

    // Site admin can send a test email
    await adminUser.getCsrfToken()
    const sendTestEmailResponse = await adminUser.fetch(
      '/launchpad/send_test_email',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email: 'someone@example.com' }),
      }
    )
    expect(sendTestEmailResponse.status).to.equal(200)
    expect(await sendTestEmailResponse.json()).to.deep.equal({
      message: 'Email Sent',
    })

    // Reject requests carrying a field the strict body schema doesn't know
    // about
    const unknownEmailFieldResponse = await adminUser.fetch(
      '/launchpad/send_test_email',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: 'someone@example.com',
          notAField: 'nope',
        }),
      }
    )
    const unknownEmailFieldBody = await unknownEmailFieldResponse.text()
    expectValidationErrorRaw(
      {
        statusCode: unknownEmailFieldResponse.status,
        body: unknownEmailFieldBody,
      },
      400,
      'notAField'
    )
  })

  it('should deny a non-admin user access to send a test email', async function () {
    const nonAdminUser = await UserHelper.createUser()
    const loggedInUser = await UserHelper.loginUser({
      email: nonAdminUser.getDefaultEmail(),
      password: nonAdminUser.getDefaultPassword(),
    })
    await loggedInUser.getCsrfToken()

    const response = await loggedInUser.fetch('/launchpad/send_test_email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email: 'someone@example.com' }),
    })
    expect(response.status).to.equal(302)
    expect(response.headers.get('location')).to.equal(
      UserHelper.url(
        '/restricted?from=%2Flaunchpad%2Fsend_test_email'
      ).toString()
    )
  })
})
