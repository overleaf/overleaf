const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { assert } = require('chai')

const modulePath = '../../../../app/src/Features/User/UserCreator.js'

describe('UserCreator', function () {
  beforeEach(function () {
    const self = this
    this.user = { _id: '12390i', ace: {} }
    this.user.save = sinon.stub().resolves(self.user)
    this.UserModel = class Project {
      constructor() {
        return self.user
      }
    }
    this.UserCreator = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/User': {
          User: this.UserModel,
        },
        '@overleaf/metrics': { timeAsyncMethod() {} },
        '../../infrastructure/Features': (this.Features = {
          hasFeature: sinon.stub().returns(false),
        }),
        './UserDeleter': (this.UserDeleter = {
          promises: {
            deleteNewUser: sinon.stub().resolves(),
          },
        }),
        './UserGetter': (this.UserGetter = {
          promises: {
            getUser: sinon.stub().resolves(this.user),
          },
        }),
        './UserUpdater': (this.UserUpdater = {
          promises: {
            addAffiliationForNewUser: sinon.stub().resolves({
              matchedCount: 1,
              modifiedCount: 1,
              acknowledged: true,
            }),
            updateUser: sinon.stub().resolves(),
          },
        }),
        '../Analytics/AnalyticsManager': (this.Analytics = {
          recordEventForUser: sinon.stub(),
          setUserPropertyForUser: sinon.stub(),
        }),
        '../SplitTests/SplitTestHandler': (this.SplitTestHandler = {
          promises: {
            getAssignmentForUser: sinon.stub().resolves({ variant: 'active' }),
          },
        }),
        './UserOnboardingEmailManager': (this.UserOnboardingEmailManager = {
          scheduleOnboardingEmail: sinon.stub(),
        }),
        './UserPostRegistrationAnalyticsManager':
          (this.UserPostRegistrationAnalyticsManager = {
            schedulePostRegistrationAnalytics: sinon.stub(),
          }),
      },
    })

    this.email = 'bob.oswald@gmail.com'
  })

  describe('createNewUser', function () {
    describe('with callbacks', function () {
      it('should take the opts and put them in the model', async function () {
        const user = await this.UserCreator.promises.createNewUser({
          email: this.email,
          holdingAccount: true,
        })
        assert.equal(user.email, this.email)
        assert.equal(user.holdingAccount, true)
        assert.equal(user.first_name, 'bob.oswald')
      })

      it('should use the start of the email if the first name is empty string', async function () {
        const user = await this.UserCreator.promises.createNewUser({
          email: this.email,
          holdingAccount: true,
          first_name: '',
        })
        assert.equal(user.email, this.email)
        assert.equal(user.holdingAccount, true)
        assert.equal(user.first_name, 'bob.oswald')
      })

      it('should use the first name if passed', async function () {
        const user = await this.UserCreator.promises.createNewUser({
          email: this.email,
          holdingAccount: true,
          first_name: 'fiiirstname',
        })
        assert.equal(user.email, this.email)
        assert.equal(user.holdingAccount, true)
        assert.equal(user.first_name, 'fiiirstname')
      })

      it('should use the last name if passed', async function () {
        const user = await this.UserCreator.promises.createNewUser({
          email: this.email,
          holdingAccount: true,
          last_name: 'lastNammmmeee',
        })
        assert.equal(user.email, this.email)
        assert.equal(user.holdingAccount, true)
        assert.equal(user.last_name, 'lastNammmmeee')
      })

      it('should set emails attribute', async function () {
        const user = await this.UserCreator.promises.createNewUser({
          email: this.email,
        })
        user.email.should.equal(this.email)
        user.emails.length.should.equal(1)
        user.emails[0].email.should.equal(this.email)
        user.emails[0].createdAt.should.be.a('date')
        user.emails[0].reversedHostname.should.equal('moc.liamg')
      })

      describe('with affiliations feature', function () {
        let attributes, user
        beforeEach(function () {
          attributes = { email: this.email }
          this.Features.hasFeature = sinon
            .stub()
            .withArgs('affiliations')
            .returns(true)
        })

        describe('when v1 affiliations API does not return an error', function () {
          beforeEach(async function () {
            user = await this.UserCreator.promises.createNewUser(attributes)
          })

          it('should flag that affiliation is unchecked', function () {
            user.emails[0].affiliationUnchecked.should.equal(true)
          })

          it('should try to add affiliation to v1', function () {
            sinon.assert.calledOnce(
              this.UserUpdater.promises.addAffiliationForNewUser
            )
            sinon.assert.calledWithMatch(
              this.UserUpdater.promises.addAffiliationForNewUser,
              user._id,
              this.email
            )
          })

          it('should query for updated user data', function () {
            sinon.assert.calledOnce(this.UserGetter.promises.getUser)
          })
        })

        describe('when v1 affiliations API does return an error', function () {
          beforeEach(async function () {
            this.UserUpdater.promises.addAffiliationForNewUser.rejects()
            user = await this.UserCreator.promises.createNewUser(attributes)
          })

          it('should flag that affiliation is unchecked', function () {
            user.emails[0].affiliationUnchecked.should.equal(true)
          })

          it('should try to add affiliation to v1', function () {
            sinon.assert.calledOnce(
              this.UserUpdater.promises.addAffiliationForNewUser
            )
            sinon.assert.calledWithMatch(
              this.UserUpdater.promises.addAffiliationForNewUser,
              user._id,
              this.email
            )
          })

          it('should not query for updated user data', function () {
            sinon.assert.notCalled(this.UserGetter.promises.getUser)
          })

          it('should log error', function () {
            sinon.assert.calledOnce(this.logger.error)
          })
        })

        describe('when v1 affiliations API returns an error and requireAffiliation=true', function () {
          beforeEach(async function () {
            this.UserUpdater.promises.addAffiliationForNewUser.rejects()
            user = await this.UserCreator.promises.createNewUser(attributes)
          })

          it('should flag that affiliation is unchecked', function () {
            user.emails[0].affiliationUnchecked.should.equal(true)
          })

          it('should try to add affiliation to v1', function () {
            sinon.assert.calledOnce(
              this.UserUpdater.promises.addAffiliationForNewUser
            )
            sinon.assert.calledWithMatch(
              this.UserUpdater.promises.addAffiliationForNewUser,
              user._id,
              this.email
            )
          })

          it('should not query for updated user data', function () {
            sinon.assert.notCalled(this.UserGetter.promises.getUser)
          })

          it('should log error', function () {
            sinon.assert.calledOnce(this.logger.error)
          })
        })
      })

      it('should not add affiliation when without affiliation feature', async function () {
        const attributes = { email: this.email }
        await this.UserCreator.promises.createNewUser(attributes)
        sinon.assert.notCalled(
          this.UserUpdater.promises.addAffiliationForNewUser
        )
      })
    })

    describe('with promises', function () {
      it('should take the opts and put them in the model', async function () {
        const opts = {
          email: this.email,
          holdingAccount: true,
        }
        const user = await this.UserCreator.promises.createNewUser(opts)
        assert.equal(user.email, this.email)
        assert.equal(user.holdingAccount, true)
        assert.equal(user.first_name, 'bob.oswald')
      })

      it('should add affiliation when with affiliation feature', async function () {
        this.Features.hasFeature = sinon
          .stub()
          .withArgs('affiliations')
          .returns(true)
        const attributes = { email: this.email }
        const user = await this.UserCreator.promises.createNewUser(attributes)
        sinon.assert.calledOnce(
          this.UserUpdater.promises.addAffiliationForNewUser
        )
        sinon.assert.calledWithMatch(
          this.UserUpdater.promises.addAffiliationForNewUser,
          user._id,
          this.email
        )
      })

      it('should not add affiliation when without affiliation feature', async function () {
        this.Features.hasFeature = sinon.stub().returns(false)
        const attributes = { email: this.email }
        await this.UserCreator.promises.createNewUser(attributes)
        sinon.assert.notCalled(
          this.UserUpdater.promises.addAffiliationForNewUser
        )
      })

      it('should include SAML provider ID with email', async function () {
        const attributes = {
          email: this.email,
          samlIdentifiers: [{ email: this.email, providerId: '1' }],
        }
        const user = await this.UserCreator.promises.createNewUser(attributes)
        assert.equal(user.emails[0].samlProviderId, '1')
      })

      it('should fire an analytics event and user property on registration', async function () {
        const user = await this.UserCreator.promises.createNewUser({
          email: this.email,
        })
        assert.equal(user.email, this.email)
        sinon.assert.calledWith(
          this.Analytics.recordEventForUser,
          user._id,
          'user-registered'
        )
        sinon.assert.calledWith(
          this.Analytics.setUserPropertyForUser,
          user._id,
          'created-at'
        )
      })

      it('should schedule post registration jobs on registration with saas feature', async function () {
        this.Features.hasFeature = sinon.stub().withArgs('saas').returns(true)
        const user = await this.UserCreator.promises.createNewUser({
          email: this.email,
        })
        assert.equal(user.email, this.email)
        sinon.assert.calledWith(
          this.UserOnboardingEmailManager.scheduleOnboardingEmail,
          user
        )
        sinon.assert.calledWith(
          this.UserPostRegistrationAnalyticsManager
            .schedulePostRegistrationAnalytics,
          user
        )
      })

      it('should not schedule post registration checks when without saas feature', async function () {
        const attributes = { email: this.email }
        await this.UserCreator.promises.createNewUser(attributes)
        sinon.assert.notCalled(
          this.UserOnboardingEmailManager.scheduleOnboardingEmail
        )
        sinon.assert.notCalled(
          this.UserPostRegistrationAnalyticsManager
            .schedulePostRegistrationAnalytics
        )
      })
    })
  })
})
