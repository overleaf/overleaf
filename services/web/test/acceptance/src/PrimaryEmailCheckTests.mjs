import UserHelper from './helpers/UserHelper.mjs'
import Settings from '@overleaf/settings'
import { expect } from 'chai'
import Features from '../../../app/src/infrastructure/Features.mjs'
import MockV1ApiClass from './mocks/MockV1Api.mjs'
import SubscriptionHelper from './helpers/Subscription.mjs'

const Subscription = SubscriptionHelper.promises

describe('PrimaryEmailCheck', function () {
  let userHelper
  let MockV1Api

  before(function () {
    MockV1Api = MockV1ApiClass.instance()
  })

  beforeEach(async function () {
    userHelper = await UserHelper.createUser()
    userHelper = await UserHelper.loginUser(
      userHelper.getDefaultEmailPassword()
    )
  })

  describe('redirections in Overleaf Community Edition/Server Pro', function () {
    before(async function () {
      if (Features.hasFeature('saas')) {
        this.skip()
      }
    })

    describe('when the user has signed up recently', function () {
      it("shouldn't be redirected from project list to the primary email check page", async function () {
        const response = await userHelper.fetch('/project')
        expect(response.status).to.equal(200)
      })

      it('should be redirected from the primary email check page to the project list', async function () {
        const response = await userHelper.fetch(
          '/user/emails/primary-email-check'
        )
        expect(response.status).to.equal(302)
        expect(response.headers.get('location')).to.equal(
          UserHelper.url('/project').toString()
        )
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
        const response = await userHelper.fetch('/project')
        expect(response.status).to.equal(200)
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

        await userHelper.confirmEmail(userHelper.user.email)
      })

      it("shouldn't be redirected from project list to the primary email check page", async function () {
        const response = await userHelper.fetch('/project')
        expect(response.status).to.equal(200)
      })
    })

    describe('when the user has signed for longer than the email check expiration period', function () {
      beforeEach(async function () {
        const time = Date.now() - Settings.primary_email_check_expiration * 2
        await UserHelper.updateUser(userHelper.user._id, {
          $set: { lastPrimaryEmailCheck: new Date(time) },
        })
      })

      it("shouldn't be redirected from project list to the primary email check page", async function () {
        const response = await userHelper.fetch('/project')
        expect(response.status).to.equal(200)
      })
    })
  })

  describe('redirections in SAAS', function () {
    before(async function () {
      if (!Features.hasFeature('saas')) {
        this.skip()
      }
    })

    describe('when the user has signed up recently', function () {
      it("shouldn't be redirected from project list to the primary email check page", async function () {
        const response = await userHelper.fetch('/project')
        expect(response.status).to.equal(200)
      })

      it('should be redirected from the primary email check page to the project list', async function () {
        const response = await userHelper.fetch(
          '/user/emails/primary-email-check'
        )
        expect(response.status).to.equal(302)
        expect(response.headers.get('location')).to.equal(
          UserHelper.url('/project').toString()
        )
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
        const response = await userHelper.fetch('/project')
        expect(response.status).to.equal(200)
      })

      it('should be redirected from the primary email check page to the project list', async function () {
        const response = await userHelper.fetch(
          '/user/emails/primary-email-check'
        )
        expect(response.status).to.equal(302)
        expect(response.headers.get('location')).to.equal(
          UserHelper.url('/project').toString()
        )
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

        await userHelper.confirmEmail(userHelper.user.email)
      })

      it("shouldn't be redirected from project list to the primary email check page", async function () {
        const response = await userHelper.fetch('/project')
        expect(response.status).to.equal(200)
      })

      it('should be redirected from the primary email check page to the project list', async function () {
        const response = await userHelper.fetch(
          '/user/emails/primary-email-check'
        )
        expect(response.status).to.equal(302)
        expect(response.headers.get('location')).to.equal(
          UserHelper.url('/project').toString()
        )
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
        const response = await userHelper.fetch('/project')
        expect(response.status).to.equal(302)
        expect(response.headers.get('location')).to.equal(
          UserHelper.url('/user/emails/primary-email-check').toString()
        )
      })

      it('can visit the primary email check page', async function () {
        const response = await userHelper.fetch(
          '/user/emails/primary-email-check'
        )
        expect(response.status).to.equal(200)
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
    })

    describe('when the user has a secondary email address', function () {
      before(async function () {
        if (!Features.hasFeature('saas')) {
          this.skip()
        }
      })

      beforeEach(async function () {
        await userHelper.confirmEmail(userHelper.user.email)
        await userHelper.addEmailAndConfirm('secondary@overleaf.com')

        checkResponse = await userHelper.fetch(
          '/user/emails/primary-email-check',
          { method: 'POST' }
        )
      })

      it('should be redirected to the project list page', function () {
        expect(checkResponse.status).to.equal(302)
        expect(checkResponse.headers.get('location')).to.equal(
          UserHelper.url('/project').toString()
        )
      })
    })

    describe('when the user has an institutional email and no secondary', function () {
      before(async function () {
        if (!Features.hasFeature('saas')) {
          this.skip()
        }

        if (!Features.hasFeature('saml')) {
          this.skip()
        }
      })

      beforeEach(async function () {
        MockV1Api.createInstitution({
          name: 'Exampe Institution',
          hostname: 'example.com',
          licence: 'pro_plus',
          confirmed: true,
        })
        MockV1Api.addAffiliation(userHelper.user._id, userHelper.user.email)
      })

      it('should be redirected to the add secondary email page', async function () {
        const response = await userHelper.fetch(
          '/user/emails/primary-email-check',
          { method: 'POST' }
        )
        expect(response.status).to.equal(302)
        expect(response.headers.get('location')).to.equal(
          UserHelper.url('/user/emails/add-secondary').toString()
        )
      })
    })

    describe('when the user is a managed user', function () {
      beforeEach(async function () {
        if (!Features.hasFeature('saas')) {
          this.skip()
        }

        const adminUser = await UserHelper.createUser()
        this.subscription = new Subscription({
          adminId: adminUser._id,
          memberIds: [userHelper.user._id],
          groupPlan: true,
          planCode: 'group_professional_5_enterprise',
        })
        await this.subscription.ensureExists()
        await this.subscription.enableManagedUsers()
      })

      it('should be redirected to the project list page', async function () {
        const response = await userHelper.fetch(
          '/user/emails/primary-email-check',
          { method: 'POST' }
        )

        expect(response.status).to.equal(302)
        expect(response.headers.get('location')).to.equal(
          UserHelper.url('/project').toString()
        )
      })
    })
  })

  describe('when user has checked their primary email address', function () {
    beforeEach(async function () {
      const time = Date.now() - Settings.primary_email_check_expiration * 2
      await UserHelper.updateUser(userHelper.user._id, {
        $set: { lastPrimaryEmailCheck: new Date(time) },
      })

      await userHelper.fetch('/user/emails/primary-email-check', {
        method: 'POST',
      })
    })

    it("shouldn't be redirected from project list to the primary email check page any longer", async function () {
      const response = await userHelper.fetch('/project')
      expect(response.status).to.equal(200)
    })

    it('visiting the primary email check page should redirect to the project list page', async function () {
      const response = await userHelper.fetch(
        '/user/emails/primary-email-check'
      )
      expect(response.status).to.equal(302)
      expect(response.headers.get('location')).to.equal(
        UserHelper.url('/project').toString()
      )
    })
  })
})
