import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import OneTimeTokenHandler from '../../../app/src/Features/Security/OneTimeTokenHandler.mjs'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

const User = UserHelper.promises

describe('Confirm email via link/token (UserEmailsController.confirm)', function () {
  let user

  beforeEach('login', async function () {
    user = new User()
    await user.login()
  })

  async function getTokenForUser() {
    return OneTimeTokenHandler.promises.getNewToken(
      'email_confirmation',
      { user_id: user.id, email: user.email },
      { expiresIn: 24 * 60 * 60 }
    )
  }

  it('should accept the redundant _csrf field the async-form helper packs into the body', async function () {
    // views/user/confirm_email.pug's confirmEmailForm carries
    // data-ol-async-form: hydrate-form.ts's async-form helper packs all
    // FormData -- including the hidden _csrf input -- into the JSON body
    // on top of the X-Csrf-Token header it sets, so confirmEmailSchema
    // must tolerate _csrf turning up in the body too.
    const token = await getTokenForUser()
    const { response } = await user.doRequest('POST', {
      url: '/user/emails/confirm',
      json: { token, _csrf: user.csrfToken },
    })
    expect(response.statusCode).to.equal(200)
  })

  it('should still reject a non-string token', async function () {
    const { response, body } = await user.doRequest('POST', {
      url: '/user/emails/confirm',
      json: { token: ['not', 'a', 'string'], _csrf: user.csrfToken },
    })
    expectValidationErrorRaw(
      { statusCode: response.statusCode, body },
      400,
      'token'
    )
  })

  it('should 404 for an invalid token (proving the request reaches the handler, not blocked by the schema)', async function () {
    const { response, body } = await user.doRequest('POST', {
      url: '/user/emails/confirm',
      json: { token: 'not-a-real-token', _csrf: user.csrfToken },
    })
    expect(response.statusCode).to.equal(404)
    expect(body.message).to.equal(
      'Sorry, your confirmation token is invalid or has expired. Please request a new email confirmation link.'
    )
  })
})

describe('Show confirm email page (UserEmailsController.showConfirm)', function () {
  let user

  beforeEach('login', async function () {
    user = new User()
    await user.login()
  })

  it('should render the page with the token from the query string', async function () {
    const { response, body } = await user.doRequest('GET', {
      url: '/user/emails/confirm?token=mock-confirm-token',
    })
    expect(response.statusCode).to.equal(200)
    expect(body).to.include('value="mock-confirm-token"')
  })

  it('should reject an invalid token query value', async function () {
    const { response, body } = await user.doRequest('GET', {
      url: '/user/emails/confirm?token[foo]=bar',
      json: true,
    })
    expectValidationErrorRaw(
      { statusCode: response.statusCode, body },
      400,
      'token'
    )
  })
})
