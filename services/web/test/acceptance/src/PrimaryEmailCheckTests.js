const UserHelper = require('./helpers/UserHelper')
const Settings = require('@overleaf/settings')
const { expect } = require('chai')
const SplitTestManager = require('../../../app/src/Features/SplitTests/SplitTestManager')

// While the split test is in progress this must be appended to URLs during tests
const SPLIT_TEST_QUERY = '?primary-email-check=active'

describe('PrimaryEmailCheck', function () {
  let userHelper

  // Create the primary-email-check split test because this is now required for the query string override to work. See
  // https://github.com/overleaf/internal/pull/7545#discussion_r848575736
  before(async function () {
    await SplitTestManager.createSplitTest('primary-email-check', {
      active: true,
      analyticsEnabled: true,
      phase: 'release',
      variants: [
        {
          name: 'active',
          rolloutPercent: 0,
        },
      ],
    })
  })

  beforeEach(async function () {
    userHelper = await UserHelper.createUser()
    userHelper = await UserHelper.loginUser(
      userHelper.getDefaultEmailPassword()
    )
  })

  describe('redirections', function () {
    describe('when the user has signed up recently', function () {
      it("shouldn't be redirected from project list to the primary email check page", async function () {
        const response = await userHelper.request.get(
          '/project' + SPLIT_TEST_QUERY
        )
        expect(response.statusCode).to.equal(200)
      })

      it('should be redirected from the primary email check page to the project list', async function () {
        const response = await userHelper.request.get(
          '/user/emails/primary-email-check' + SPLIT_TEST_QUERY,
          { simple: false }
        )
        expect(response.statusCode).to.equal(302)
        expect(response.headers.location).to.equal('/project')
      })
    })

    describe('when the user has checked their email recently', function () {
      beforeEach(async function () {
        const time = Date.now() - Settings.primary_email_check_expiration * 0.5
        await UserHelper.updateUser(userHelper.user._id, {
          $set: { lastPrimaryEmailCheck: new Date(time) },
        })
      })

      it("shouldn't be redirected from project list to the primary email check page", async function () {
        const response = await userHelper.request.get(
          '/project' + SPLIT_TEST_QUERY
        )
        expect(response.statusCode).to.equal(200)
      })

      it('should be redirected from the primary email check page to the project list', async function () {
        const response = await userHelper.request.get(
          '/user/emails/primary-email-check' + SPLIT_TEST_QUERY,
          { simple: false }
        )
        expect(response.statusCode).to.equal(302)
        expect(response.headers.location).to.equal('/project')
      })
    })

    describe('when the user has confirmed their primary email recently', function () {
      beforeEach(async function () {
        // the user should check again their email according to `lastPrimaryEmailCheck` timestamp, but the behaviour is
        // overridden by email confirmation
        const time = Date.now() - Settings.primary_email_check_expiration * 2
        await UserHelper.updateUser(userHelper.user._id, {
          $set: { lastPrimaryEmailCheck: new Date(time) },
        })

        await userHelper.confirmEmail(
          userHelper.user._id,
          userHelper.user.email
        )
      })

      it("shouldn't be redirected from project list to the primary email check page", async function () {
        const response = await userHelper.request.get(
          '/project' + SPLIT_TEST_QUERY
        )
        expect(response.statusCode).to.equal(200)
      })

      it('should be redirected from the primary email check page to the project list', async function () {
        const response = await userHelper.request.get(
          '/user/emails/primary-email-check' + SPLIT_TEST_QUERY,
          { simple: false }
        )
        expect(response.statusCode).to.equal(302)
        expect(response.headers.location).to.equal('/project')
      })
    })

    describe('when the user has signed for longer than the email check expiration period', function () {
      beforeEach(async function () {
        const time = Date.now() - Settings.primary_email_check_expiration * 2
        await UserHelper.updateUser(userHelper.user._id, {
          $set: { lastPrimaryEmailCheck: new Date(time) },
        })
      })

      it('should be redirected from project list to the primary email check page', async function () {
        const response = await userHelper.request.get(
          '/project' + SPLIT_TEST_QUERY,
          { simple: false }
        )
        expect(response.statusCode).to.equal(302)
        expect(response.headers.location).to.equal(
          '/user/emails/primary-email-check'
        )
      })

      it('can visit the primary email check page', async function () {
        const response = await userHelper.request.get(
          '/user/emails/primary-email-check'
        )
        expect(response.statusCode).to.equal(200)
      })
    })
  })

  describe('when user checks their primary email address', function () {
    let checkResponse

    beforeEach(async function () {
      // make sure the user requires checking their primary email address
      const time = Date.now() - Settings.primary_email_check_expiration * 2
      await UserHelper.updateUser(userHelper.user._id, {
        $set: { lastPrimaryEmailCheck: new Date(time) },
      })

      checkResponse = await userHelper.request.post(
        '/user/emails/primary-email-check' + SPLIT_TEST_QUERY,
        {
          form: {},
          simple: false,
        }
      )
    })

    it('should be redirected to the project list page', function () {
      expect(checkResponse.statusCode).to.equal(302)
      expect(checkResponse.headers.location).to.equal('/project')
    })

    it("shouldn't be redirected from project list to the primary email check page any longer", async function () {
      const response = await userHelper.request.get(
        '/project' + SPLIT_TEST_QUERY
      )
      expect(response.statusCode).to.equal(200)
    })

    it('visiting the primary email check page should redirect to the project list page', async function () {
      const response = await userHelper.request.get(
        '/user/emails/primary-email-check',
        { simple: false }
      )
      expect(response.statusCode).to.equal(302)
      expect(response.headers.location).to.equal('/project')
    })
  })
})
