import { vi, assert } from 'vitest'
import sinon from 'sinon'

const modulePath = '../../../../app/src/Features/User/UserCreator.mjs'

describe('UserCreator', function () {
  beforeEach(async function (ctx) {
    const self = ctx
    ctx.user = { _id: '12390i', ace: {} }
    ctx.user.save = sinon.stub().resolves(self.user)
    ctx.UserModel = class Project {
      constructor() {
        return self.user
      }
    }

    ctx.logger = {
      error: sinon.stub(),
    }
    vi.doMock('@overleaf/logger', () => ({
      default: ctx.logger,
    }))

    vi.doMock('../../../../app/src/models/User', () => ({
      User: ctx.UserModel,
    }))

    vi.doMock('../../../../app/src/infrastructure/Features', () => ({
      default: (ctx.Features = {
        hasFeature: sinon.stub().returns(false),
      }),
    }))

    vi.doMock('../../../../app/src/Features/User/UserDeleter', () => ({
      default: (ctx.UserDeleter = {
        promises: {
          deleteNewUser: sinon.stub().resolves(),
        },
      }),
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: (ctx.UserGetter = {
        promises: {
          getUser: sinon.stub().resolves(ctx.user),
        },
      }),
    }))

    vi.doMock('../../../../app/src/Features/User/UserUpdater', () => ({
      default: (ctx.UserUpdater = {
        promises: {
          addAffiliationForNewUser: sinon.stub().resolves({
            matchedCount: 1,
            modifiedCount: 1,
            acknowledged: true,
          }),
          updateUser: sinon.stub().resolves(),
        },
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: (ctx.Analytics = {
          recordEventForUserInBackground: sinon.stub(),
          setUserPropertyForUser: sinon.stub(),
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: (ctx.SplitTestHandler = {
          promises: {
            getAssignmentForUser: sinon.stub().resolves({ variant: 'active' }),
          },
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/User/UserOnboardingEmailManager',
      () => ({
        default: (ctx.UserOnboardingEmailManager = {
          scheduleOnboardingEmail: sinon.stub(),
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/User/UserPostRegistrationAnalyticsManager',
      () => ({
        default: (ctx.UserPostRegistrationAnalyticsManager = {
          schedulePostRegistrationAnalytics: sinon.stub(),
        }),
      })
    )

    ctx.UserCreator = (await import(modulePath)).default

    ctx.email = 'bob.oswald@gmail.com'
  })

  describe('createNewUser', function () {
    describe('with callbacks', function () {
      it('should take the opts and put them in the model', async function (ctx) {
        const user = await ctx.UserCreator.promises.createNewUser({
          email: ctx.email,
          holdingAccount: true,
        })
        assert.equal(user.email, ctx.email)
        assert.equal(user.holdingAccount, true)
        assert.equal(user.first_name, 'bob.oswald')
      })

      it('should use the start of the email if the first name is empty string', async function (ctx) {
        const user = await ctx.UserCreator.promises.createNewUser({
          email: ctx.email,
          holdingAccount: true,
          first_name: '',
        })
        assert.equal(user.email, ctx.email)
        assert.equal(user.holdingAccount, true)
        assert.equal(user.first_name, 'bob.oswald')
      })

      it('should use the first name if passed', async function (ctx) {
        const user = await ctx.UserCreator.promises.createNewUser({
          email: ctx.email,
          holdingAccount: true,
          first_name: 'fiiirstname',
        })
        assert.equal(user.email, ctx.email)
        assert.equal(user.holdingAccount, true)
        assert.equal(user.first_name, 'fiiirstname')
      })

      it('should use the last name if passed', async function (ctx) {
        const user = await ctx.UserCreator.promises.createNewUser({
          email: ctx.email,
          holdingAccount: true,
          last_name: 'lastNammmmeee',
        })
        assert.equal(user.email, ctx.email)
        assert.equal(user.holdingAccount, true)
        assert.equal(user.last_name, 'lastNammmmeee')
      })

      it('should set emails attribute', async function (ctx) {
        const user = await ctx.UserCreator.promises.createNewUser({
          email: ctx.email,
        })
        user.email.should.equal(ctx.email)
        user.emails.length.should.equal(1)
        user.emails[0].email.should.equal(ctx.email)
        user.emails[0].createdAt.should.be.a('date')
        user.emails[0].reversedHostname.should.equal('moc.liamg')
      })

      describe('with affiliations feature', function () {
        let attributes, user
        beforeEach(function (ctx) {
          attributes = { email: ctx.email }
          ctx.Features.hasFeature = sinon
            .stub()
            .withArgs('affiliations')
            .returns(true)
        })

        describe('when v1 affiliations API does not return an error', function () {
          beforeEach(async function (ctx) {
            user = await ctx.UserCreator.promises.createNewUser(attributes)
          })

          it('should flag that affiliation is unchecked', function () {
            user.emails[0].affiliationUnchecked.should.equal(true)
          })

          it('should try to add affiliation to v1', function (ctx) {
            sinon.assert.calledOnce(
              ctx.UserUpdater.promises.addAffiliationForNewUser
            )
            sinon.assert.calledWithMatch(
              ctx.UserUpdater.promises.addAffiliationForNewUser,
              user._id,
              ctx.email
            )
          })

          it('should query for updated user data', function (ctx) {
            sinon.assert.calledOnce(ctx.UserGetter.promises.getUser)
          })
        })

        describe('when v1 affiliations API does return an error', function () {
          beforeEach(async function (ctx) {
            ctx.UserUpdater.promises.addAffiliationForNewUser.rejects()
            user = await ctx.UserCreator.promises.createNewUser(attributes)
          })

          it('should flag that affiliation is unchecked', function () {
            user.emails[0].affiliationUnchecked.should.equal(true)
          })

          it('should try to add affiliation to v1', function (ctx) {
            sinon.assert.calledOnce(
              ctx.UserUpdater.promises.addAffiliationForNewUser
            )
            sinon.assert.calledWithMatch(
              ctx.UserUpdater.promises.addAffiliationForNewUser,
              user._id,
              ctx.email
            )
          })

          it('should not query for updated user data', function (ctx) {
            sinon.assert.notCalled(ctx.UserGetter.promises.getUser)
          })

          it('should log error', function (ctx) {
            sinon.assert.calledOnce(ctx.logger.error)
          })
        })

        describe('when v1 affiliations API returns an error and requireAffiliation=true', function () {
          beforeEach(async function (ctx) {
            ctx.UserUpdater.promises.addAffiliationForNewUser.rejects()
            user = await ctx.UserCreator.promises.createNewUser(attributes)
          })

          it('should flag that affiliation is unchecked', function () {
            user.emails[0].affiliationUnchecked.should.equal(true)
          })

          it('should try to add affiliation to v1', function (ctx) {
            sinon.assert.calledOnce(
              ctx.UserUpdater.promises.addAffiliationForNewUser
            )
            sinon.assert.calledWithMatch(
              ctx.UserUpdater.promises.addAffiliationForNewUser,
              user._id,
              ctx.email
            )
          })

          it('should not query for updated user data', function (ctx) {
            sinon.assert.notCalled(ctx.UserGetter.promises.getUser)
          })

          it('should log error', function (ctx) {
            sinon.assert.calledOnce(ctx.logger.error)
          })
        })
      })

      it('should not add affiliation when without affiliation feature', async function (ctx) {
        const attributes = { email: ctx.email }
        await ctx.UserCreator.promises.createNewUser(attributes)
        sinon.assert.notCalled(
          ctx.UserUpdater.promises.addAffiliationForNewUser
        )
      })
    })

    describe('with promises', function () {
      it('should take the opts and put them in the model', async function (ctx) {
        const opts = {
          email: ctx.email,
          holdingAccount: true,
        }
        const user = await ctx.UserCreator.promises.createNewUser(opts)
        assert.equal(user.email, ctx.email)
        assert.equal(user.holdingAccount, true)
        assert.equal(user.first_name, 'bob.oswald')
      })

      it('should add affiliation when with affiliation feature', async function (ctx) {
        ctx.Features.hasFeature = sinon
          .stub()
          .withArgs('affiliations')
          .returns(true)
        const attributes = { email: ctx.email }
        const user = await ctx.UserCreator.promises.createNewUser(attributes)
        sinon.assert.calledOnce(
          ctx.UserUpdater.promises.addAffiliationForNewUser
        )
        sinon.assert.calledWithMatch(
          ctx.UserUpdater.promises.addAffiliationForNewUser,
          user._id,
          ctx.email
        )
      })

      it('should not add affiliation when without affiliation feature', async function (ctx) {
        ctx.Features.hasFeature = sinon.stub().returns(false)
        const attributes = { email: ctx.email }
        await ctx.UserCreator.promises.createNewUser(attributes)
        sinon.assert.notCalled(
          ctx.UserUpdater.promises.addAffiliationForNewUser
        )
      })

      it('should include SAML provider ID with email', async function (ctx) {
        const attributes = {
          email: ctx.email,
          samlIdentifiers: [{ email: ctx.email, providerId: '1' }],
        }
        const user = await ctx.UserCreator.promises.createNewUser(attributes)
        assert.equal(user.emails[0].samlProviderId, '1')
      })

      it('should fire an analytics event and user property on registration', async function (ctx) {
        const user = await ctx.UserCreator.promises.createNewUser({
          email: ctx.email,
        })
        assert.equal(user.email, ctx.email)
        sinon.assert.calledWith(
          ctx.Analytics.recordEventForUserInBackground,
          user._id,
          'user-registered'
        )
        sinon.assert.calledWith(
          ctx.Analytics.setUserPropertyForUser,
          user._id,
          'created-at'
        )
      })

      it('should schedule post registration jobs on registration with saas feature', async function (ctx) {
        ctx.Features.hasFeature = sinon.stub().withArgs('saas').returns(true)
        const user = await ctx.UserCreator.promises.createNewUser({
          email: ctx.email,
        })
        assert.equal(user.email, ctx.email)
        sinon.assert.calledWith(
          ctx.UserOnboardingEmailManager.scheduleOnboardingEmail,
          user
        )
        sinon.assert.calledWith(
          ctx.UserPostRegistrationAnalyticsManager
            .schedulePostRegistrationAnalytics,
          user
        )
      })

      it('should not schedule post registration checks when without saas feature', async function (ctx) {
        const attributes = { email: ctx.email }
        await ctx.UserCreator.promises.createNewUser(attributes)
        sinon.assert.notCalled(
          ctx.UserOnboardingEmailManager.scheduleOnboardingEmail
        )
        sinon.assert.notCalled(
          ctx.UserPostRegistrationAnalyticsManager
            .schedulePostRegistrationAnalytics
        )
      })
    })
  })
})
