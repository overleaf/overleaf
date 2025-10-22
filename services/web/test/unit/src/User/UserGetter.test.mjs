const { ObjectId } = require('mongodb-legacy')
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const moment = require('moment')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/User/UserGetter'
)
const { expect } = require('chai')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const {
  normalizeQuery,
  normalizeMultiQuery,
} = require('../../../../app/src/Features/Helpers/Mongo')

describe('UserGetter', function () {
  beforeEach(function () {
    const confirmedAt = new Date()
    this.fakeUser = {
      _id: new ObjectId(),
      email: 'email2@foo.bar',
      emails: [
        {
          email: 'email1@foo.bar',
          reversedHostname: 'rab.oof',
          confirmedAt,
          lastConfirmedAt: confirmedAt,
        },
        { email: 'email2@foo.bar', reversedHostname: 'rab.oof' },
      ],
    }
    this.findOne = sinon.stub().resolves(this.fakeUser)
    this.findToArrayStub = sinon.stub().resolves([this.fakeUser])
    this.find = sinon.stub().returns({ toArray: this.findToArrayStub })
    this.Mongo = {
      db: {
        users: {
          findOne: this.findOne,
          find: this.find,
        },
      },
      ObjectId,
    }
    this.getUserAffiliations = sinon.stub().resolves([])

    this.Modules = {
      promises: { hooks: { fire: sinon.stub().resolves() } },
    }
    this.AsyncLocalStorage = {
      storage: {
        getStore: sinon.stub().returns(undefined),
      },
    }

    this.UserGetter = SandboxedModule.require(modulePath, {
      requires: {
        '../Helpers/Mongo': { normalizeQuery, normalizeMultiQuery },
        '../../infrastructure/mongodb': this.Mongo,
        '@overleaf/settings': (this.settings = {
          reconfirmNotificationDays: 14,
        }),
        '../Institutions/InstitutionsAPI': {
          promises: {
            getUserAffiliations: this.getUserAffiliations,
          },
        },
        '../../infrastructure/Features': {
          hasFeature: sinon.stub().returns(true),
        },
        '../../models/User': {
          User: (this.User = {}),
        },
        '../../infrastructure/Modules': this.Modules,
        '../../infrastructure/AsyncLocalStorage': this.AsyncLocalStorage,
      },
    })
  })

  describe('getSsoUsersAtInstitution', function () {
    it('should throw an error when no projection is passed', async function () {
      await expect(
        this.UserGetter.promises.getSsoUsersAtInstitution(1, undefined)
      ).to.be.rejectedWith('missing projection')
    })
  })

  describe('getUser', function () {
    it('should get user', async function () {
      const query = { _id: '000000000000000000000000' }
      const projection = { email: 1 }
      const user = await this.UserGetter.promises.getUser(query, projection)
      this.findOne.called.should.equal(true)
      this.findOne.calledWith(query, { projection }).should.equal(true)
      expect(user).to.deep.equal(this.fakeUser)
    })

    it('should not allow null query', async function () {
      await expect(
        this.UserGetter.promises.getUser(null, {})
      ).to.be.rejectedWith('no query provided')
    })
  })

  describe('getUsers', function () {
    it('should get users with array of userIds', async function () {
      const query = [new ObjectId()]
      const projection = { email: 1 }
      const users = await this.UserGetter.promises.getUsers(query, projection)
      this.find.should.have.been.calledWithMatch(
        { _id: { $in: query } },
        { projection }
      )
      users.should.deep.equal([this.fakeUser])
    })

    it('should not call mongo with empty list', async function () {
      const query = []
      const projection = { email: 1 }
      const users = await this.UserGetter.promises.getUsers(query, projection)
      expect(users).to.deep.equal([])
      expect(this.find).to.not.have.been.called
    })

    it('should not allow null query', async function () {
      await expect(
        this.UserGetter.promises.getUsers(null, {})
      ).to.be.rejectedWith('no query provided')
    })
  })

  describe('getUserFullEmails', function () {
    it('should get user', async function () {
      this.UserGetter.promises.getUser = sinon.stub().resolves(this.fakeUser)
      const projection = { email: 1, emails: 1, samlIdentifiers: 1 }
      await this.UserGetter.promises.getUserFullEmails(this.fakeUser._id)
      this.UserGetter.promises.getUser.called.should.equal(true)
      this.UserGetter.promises.getUser
        .calledWith(this.fakeUser._id, projection)
        .should.equal(true)
    })

    it('should fetch emails data', async function () {
      this.UserGetter.promises.getUser = sinon.stub().resolves(this.fakeUser)
      const fullEmails = await this.UserGetter.promises.getUserFullEmails(
        this.fakeUser._id
      )

      assert.deepEqual(fullEmails, [
        {
          email: 'email1@foo.bar',
          reversedHostname: 'rab.oof',
          confirmedAt: this.fakeUser.emails[0].confirmedAt,
          lastConfirmedAt: this.fakeUser.emails[0].lastConfirmedAt,
          emailHasInstitutionLicence: false,
          default: false,
        },
        {
          email: 'email2@foo.bar',
          reversedHostname: 'rab.oof',
          emailHasInstitutionLicence: false,
          default: true,
          lastConfirmedAt: null,
        },
      ])
    })

    it('should merge affiliation data', async function () {
      this.UserGetter.promises.getUser = sinon.stub().resolves(this.fakeUser)
      const affiliationsData = [
        {
          email: 'email1@foo.bar',
          role: 'Prof',
          cached_confirmed_at: '2019-07-11T18:25:01.639Z',
          cached_reconfirmed_at: '2021-07-11T18:25:01.639Z',
          department: 'Maths',
          entitlement: false,
          inferred: false,
          licence: 'pro_plus',
          institution: {
            name: 'University Name',
            isUniversity: true,
            confirmed: true,
          },
          last_day_to_reconfirm: undefined,
          past_reconfirm_date: false,
          portal: undefined,
        },
      ]
      this.getUserAffiliations.resolves(affiliationsData)
      const fullEmails = await this.UserGetter.promises.getUserFullEmails(
        this.fakeUser._id
      )

      assert.deepEqual(fullEmails, [
        {
          email: 'email1@foo.bar',
          reversedHostname: 'rab.oof',
          confirmedAt: this.fakeUser.emails[0].confirmedAt,
          lastConfirmedAt: this.fakeUser.emails[0].lastConfirmedAt,
          default: false,
          emailHasInstitutionLicence: true,
          affiliation: {
            institution: affiliationsData[0].institution,
            inferred: affiliationsData[0].inferred,
            department: affiliationsData[0].department,
            role: affiliationsData[0].role,
            lastDayToReconfirm: undefined,
            licence: affiliationsData[0].licence,
            inReconfirmNotificationPeriod: false,
            cachedConfirmedAt: '2019-07-11T18:25:01.639Z',
            cachedReconfirmedAt: '2021-07-11T18:25:01.639Z',
            cachedEntitlement: false,
            cachedLastDayToReconfirm: undefined,
            cachedPastReconfirmDate: false,
            pastReconfirmDate: false,
            portal: undefined,
          },
        },
        {
          email: 'email2@foo.bar',
          reversedHostname: 'rab.oof',
          emailHasInstitutionLicence: false,
          default: true,
          lastConfirmedAt: null,
        },
      ])
    })

    it('should merge SAML identifier', async function () {
      const fakeSamlIdentifiers = [
        { providerId: 'saml_id', externalUserId: 'whatever' },
      ]
      const fakeUserWithSaml = this.fakeUser
      fakeUserWithSaml.emails[0].samlProviderId = 'saml_id'
      fakeUserWithSaml.samlIdentifiers = fakeSamlIdentifiers
      this.UserGetter.promises.getUser = sinon.stub().resolves(this.fakeUser)
      this.getUserAffiliations.resolves([])
      const fullEmails = await this.UserGetter.promises.getUserFullEmails(
        this.fakeUser._id
      )

      assert.deepEqual(fullEmails, [
        {
          email: 'email1@foo.bar',
          reversedHostname: 'rab.oof',
          confirmedAt: this.fakeUser.emails[0].confirmedAt,
          lastConfirmedAt: this.fakeUser.emails[0].lastConfirmedAt,
          default: false,
          emailHasInstitutionLicence: false,
          samlProviderId: 'saml_id',
          samlIdentifier: fakeSamlIdentifiers[0],
        },
        {
          email: 'email2@foo.bar',
          reversedHostname: 'rab.oof',
          emailHasInstitutionLicence: false,
          default: true,
          lastConfirmedAt: null,
        },
      ])
    })

    it('should get user when it has no emails field', async function () {
      this.fakeUserNoEmails = {
        _id: '12390i',
        email: 'email2@foo.bar',
      }
      this.UserGetter.promises.getUser = sinon
        .stub()
        .resolves(this.fakeUserNoEmails)
      const projection = { email: 1, emails: 1, samlIdentifiers: 1 }
      const fullEmails = await this.UserGetter.promises.getUserFullEmails(
        this.fakeUserNoEmails._id
      )
      this.UserGetter.promises.getUser.called.should.equal(true)
      this.UserGetter.promises.getUser
        .calledWith(this.fakeUserNoEmails._id, projection)
        .should.equal(true)
      assert.deepEqual(fullEmails, [])
    })

    describe('affiliation reconfirmation', function () {
      const institutionNonSSO = {
        id: 1,
        name: 'University Name',
        commonsAccount: true,
        isUniversity: true,
        confirmed: true,
        ssoBeta: false,
        ssoEnabled: false,
        maxConfirmationMonths: 12,
      }
      const institutionSSO = {
        id: 2,
        name: 'SSO University Name',
        isUniversity: true,
        confirmed: true,
        ssoBeta: false,
        ssoEnabled: true,
        maxConfirmationMonths: 12,
      }
      describe('non-SSO institutions', function () {
        const email1 = 'leonard@example-affiliation.com'
        const email2 = 'mccoy@example-affiliation.com'
        const affiliationsData = [
          {
            email: email1,
            role: 'Prof',
            department: 'Medicine',
            inferred: false,
            licence: 'pro_plus',
            institution: institutionNonSSO,
          },
          {
            email: email2,
            role: 'Prof',
            department: 'Medicine',
            inferred: false,
            licence: 'pro_plus',
            institution: institutionNonSSO,
          },
        ]
        it('should flag inReconfirmNotificationPeriod for all affiliations in period', async function () {
          const { maxConfirmationMonths } = institutionNonSSO
          const confirmed1 = moment()
            .subtract(maxConfirmationMonths + 2, 'months')
            .toDate()
          const lastDayToReconfirm1 = moment(confirmed1)
            .add(maxConfirmationMonths, 'months')
            .toDate()
          const confirmed2 = moment()
            .subtract(maxConfirmationMonths + 1, 'months')
            .toDate()
          const lastDayToReconfirm2 = moment(confirmed2)
            .add(maxConfirmationMonths, 'months')
            .toDate()
          const user = {
            _id: '12390i',
            email: email1,
            emails: [
              {
                email: email1,
                reversedHostname: 'moc.noitailiffa-elpmaxe',
                confirmedAt: confirmed1,
                default: true,
              },
              {
                email: email2,
                reversedHostname: 'moc.noitailiffa-elpmaxe',
                confirmedAt: confirmed2,
              },
            ],
          }
          const affiliations = [...affiliationsData]
          affiliations[0].last_day_to_reconfirm = lastDayToReconfirm1
          affiliations[1].last_day_to_reconfirm = lastDayToReconfirm2
          this.getUserAffiliations.resolves(affiliations)
          this.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await this.UserGetter.promises.getUserFullEmails(
            this.fakeUser._id
          )
          expect(
            fullEmails[0].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
          expect(
            fullEmails[1].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
        })

        it('should not flag affiliations outside of notification period', async function () {
          const { maxConfirmationMonths } = institutionNonSSO
          const confirmed1 = new Date()
          const lastDayToReconfirm1 = moment(confirmed1)
            .add(maxConfirmationMonths, 'months')
            .toDate()
          const confirmed2 = moment()
            .subtract(maxConfirmationMonths, 'months')
            .add(30, 'days')
            .toDate() // expires in 30 days and reconfirmNotificationDays is set to 14
          const lastDayToReconfirm2 = moment(confirmed2)
            .add(maxConfirmationMonths, 'months')
            .toDate()
          const user = {
            _id: '12390i',
            email: email1,
            emails: [
              {
                email: email1,
                reversedHostname: 'moc.noitailiffa-elpmaxe',
                confirmedAt: confirmed1,
                default: true,
              },
              {
                email: email2,
                reversedHostname: 'moc.noitailiffa-elpmaxe',
                confirmedAt: confirmed2,
              },
            ],
          }
          const affiliations = [...affiliationsData]
          affiliations[0].last_day_to_reconfirm = lastDayToReconfirm1
          affiliations[1].last_day_to_reconfirm = lastDayToReconfirm2
          this.getUserAffiliations.resolves(affiliations)
          this.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await this.UserGetter.promises.getUserFullEmails(
            this.fakeUser._id
          )
          expect(
            fullEmails[0].affiliation.inReconfirmNotificationPeriod
          ).to.equal(false)
          expect(
            fullEmails[1].affiliation.inReconfirmNotificationPeriod
          ).to.equal(false)
        })
      })

      describe('SSO institutions', function () {
        it('should flag only linked email, if in notification period', async function () {
          const { maxConfirmationMonths } = institutionSSO
          const email1 = 'email1@sso.bar'
          const email2 = 'email2@sso.bar'
          const email3 = 'email3@sso.bar'
          const reconfirmedAt = new Date('2019-09-24')
          const lastDayToReconfirm = moment(reconfirmedAt)
            .add(maxConfirmationMonths, 'months')
            .toDate()
          const user = {
            _id: '12390i',
            email: email1,
            emails: [
              {
                email: email1,
                reversedHostname: 'rab.oss',
                confirmedAt: new Date('2019-09-24'),
                reconfirmedAt,
                default: true,
              },
              {
                email: email2,
                reversedHostname: 'rab.oss',
                confirmedAt: new Date('2019-09-24'),
                reconfirmedAt,
                samlProviderId: institutionSSO.id,
              },
              {
                email: email3,
                reversedHostname: 'rab.oss',
                confirmedAt: new Date('2019-09-24'),
                reconfirmedAt,
              },
            ],
            samlIdentifiers: [
              {
                providerId: institutionSSO.id,
                externalUserId: 'abc123',
              },
            ],
          }
          const affiliations = [
            {
              email: email1,
              role: 'Prof',
              department: 'Maths!',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionSSO,
              last_day_to_reconfirm: lastDayToReconfirm,
            },
            {
              email: email2,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionSSO,
              last_day_to_reconfirm: lastDayToReconfirm,
            },
            {
              email: email3,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionSSO,
              last_day_to_reconfirm: lastDayToReconfirm,
            },
          ]
          this.getUserAffiliations.resolves(affiliations)
          this.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await this.UserGetter.promises.getUserFullEmails(
            this.fakeUser._id
          )
          expect(
            fullEmails[0].affiliation.inReconfirmNotificationPeriod
          ).to.equal(false)
          expect(
            fullEmails[1].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
          expect(
            fullEmails[2].affiliation.inReconfirmNotificationPeriod
          ).to.equal(false)
        })
      })

      describe('multiple institution affiliations', function () {
        it('should flag each institution', async function () {
          const { maxConfirmationMonths } = institutionSSO
          const email1 = 'email1@sso.bar'
          const email2 = 'email2@sso.bar'
          const email3 = 'email3@foo.bar'
          const email4 = 'email4@foo.bar'
          const confirmed1 = new Date('2019-09-24T20:25:08.503Z')
          const lastDayToReconfirm1 = moment(confirmed1)
            .add(maxConfirmationMonths, 'months')
            .toDate()
          const confirmed2 = new Date('2019-10-24T20:25:08.503Z')
          const lastDayToReconfirm2 = moment(confirmed2)
            .add(maxConfirmationMonths, 'months')
            .toDate()

          const affiliationsData = [
            {
              email: email1,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionSSO,
              last_day_to_reconfirm: lastDayToReconfirm1,
            },
            {
              email: email2,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionSSO,
              last_day_to_reconfirm: lastDayToReconfirm1,
            },
            {
              email: email3,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionNonSSO,
              last_day_to_reconfirm: lastDayToReconfirm2,
            },
            {
              email: email4,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionNonSSO,
              last_day_to_reconfirm: lastDayToReconfirm1,
            },
          ]
          const user = {
            _id: '12390i',
            email: email1,
            emails: [
              {
                email: email1,
                reversedHostname: 'rab.oss',
                confirmedAt: confirmed1,
                default: true,
              },
              {
                email: email2,
                reversedHostname: 'rab.oss',
                confirmedAt: confirmed1,
                samlProviderId: institutionSSO.id,
              },
              {
                email: email3,
                reversedHostname: 'rab.oof',
                confirmedAt: confirmed2,
              },
              {
                email: email4,
                reversedHostname: 'rab.oof',
                confirmedAt: confirmed1,
              },
            ],
            samlIdentifiers: [
              {
                providerId: institutionSSO.id,
                externalUserId: 'abc123',
              },
            ],
          }

          this.getUserAffiliations.resolves(affiliationsData)
          this.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await this.UserGetter.promises.getUserFullEmails(
            this.fakeUser._id
          )
          expect(
            fullEmails[0].affiliation.inReconfirmNotificationPeriod
          ).to.to.equal(false)
          expect(
            fullEmails[1].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
          expect(
            fullEmails[2].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
          expect(
            fullEmails[3].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
        })
      })

      describe('reconfirmedAt', function () {
        it('only use confirmedAt when no reconfirmedAt', async function () {
          const { maxConfirmationMonths } = institutionSSO
          const email1 = 'email1@foo.bar'
          const reconfirmed1 = moment().subtract(
            maxConfirmationMonths * 3,
            'months'
          )
          const lastDayToReconfirm1 = moment(reconfirmed1)
            .add(maxConfirmationMonths, 'months')
            .toDate()
          const email2 = 'email2@foo.bar'
          const reconfirmed2 = moment().subtract(
            maxConfirmationMonths * 2,
            'months'
          )
          const lastDayToReconfirm2 = moment(reconfirmed2)
            .add(maxConfirmationMonths, 'months')
            .toDate()
          const email3 = 'email3@foo.bar'
          const reconfirmed3 = moment().subtract(
            maxConfirmationMonths * 4,
            'months'
          )
          const lastDayToReconfirm3 = moment(reconfirmed3)
            .add(maxConfirmationMonths, 'months')
            .toDate()

          const affiliationsData = [
            {
              email: email1,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionNonSSO,
              last_day_to_reconfirm: lastDayToReconfirm1,
            },
            {
              email: email2,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionNonSSO,
              last_day_to_reconfirm: lastDayToReconfirm2,
            },
            {
              email: email3,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionNonSSO,
              last_day_to_reconfirm: lastDayToReconfirm3,
            },
          ]
          const user = {
            _id: '12390i',
            email: email1,
            emails: [
              {
                email: email1,
                reversedHostname: 'rab.oof',
                confirmedAt: moment().subtract(
                  institutionSSO.maxConfirmationMonths * 2,
                  'months'
                ),
                reconfirmedAt: reconfirmed1,
                default: true,
              },
              {
                email: email2,
                reversedHostname: 'rab.oof',
                confirmedAt: moment().subtract(
                  institutionSSO.maxConfirmationMonths * 3,
                  'months'
                ),
                reconfirmedAt: reconfirmed2,
              },
              {
                email: email3,
                reversedHostname: 'rab.oof',
                confirmedAt: moment().subtract(
                  institutionSSO.maxConfirmationMonths * 4,
                  'months'
                ),
                reconfirmedAt: reconfirmed3,
              },
            ],
          }
          this.getUserAffiliations.resolves(affiliationsData)
          this.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await this.UserGetter.promises.getUserFullEmails(
            this.fakeUser._id
          )
          expect(
            fullEmails[0].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
          expect(
            fullEmails[1].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
          expect(
            fullEmails[2].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
        })
      })

      describe('before reconfirmation period expires and within reconfirmation notification period', function () {
        const email = 'leonard@example-affiliation.com'
        it('should flag the email', async function () {
          const { maxConfirmationMonths } = institutionNonSSO
          const confirmedAt = moment()
            .subtract(maxConfirmationMonths, 'months')
            .subtract(14, 'days')
            .toDate() // expires in 14 days
          const affiliationsData = [
            {
              email,
              role: 'Prof',
              department: 'Medicine',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionNonSSO,
              last_day_to_reconfirm: moment(confirmedAt)
                .add(maxConfirmationMonths, 'months')
                .toDate(),
            },
          ]
          const user = {
            _id: '12390i',
            email,
            emails: [
              {
                email,
                confirmedAt,
                default: true,
              },
            ],
          }
          this.getUserAffiliations.resolves(affiliationsData)
          this.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await this.UserGetter.promises.getUserFullEmails(
            this.fakeUser._id
          )
          expect(
            fullEmails[0].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
        })
      })

      describe('when no Settings.reconfirmNotificationDays', function () {
        it('should always return inReconfirmNotificationPeriod:false', async function () {
          const email1 = 'email1@sso.bar'
          const email2 = 'email2@foo.bar'
          const email3 = 'email3@foo.bar'
          const confirmedAtAboutToExpire = moment()
            .subtract(institutionNonSSO.maxConfirmationMonths, 'months')
            .subtract(14, 'days')
            .toDate() // expires in 14 days

          const affiliationsData = [
            {
              email: email1,
              institution: institutionSSO,
            },
            {
              email: email2,
              institution: institutionNonSSO,
            },
            {
              email: email3,
              institution: institutionNonSSO,
            },
          ]
          const user = {
            _id: '12390i',
            email: email1,
            emails: [
              {
                email: email1,
                confirmedAt: confirmedAtAboutToExpire,
                default: true,
                samlProviderId: institutionSSO.id,
              },
              {
                email: email2,
                confirmedAt: new Date('2019-09-24T20:25:08.503Z'),
              },
              {
                email: email3,
                confirmedAt: new Date('2019-10-24T20:25:08.503Z'),
              },
            ],
            samlIdentifiers: [
              {
                providerId: institutionSSO.id,
                externalUserId: 'abc123',
              },
            ],
          }
          this.settings.reconfirmNotificationDays = undefined
          this.getUserAffiliations.resolves(affiliationsData)
          this.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await this.UserGetter.promises.getUserFullEmails(
            this.fakeUser._id
          )
          expect(
            fullEmails[0].affiliation.inReconfirmNotificationPeriod
          ).to.equal(false)
          expect(
            fullEmails[1].affiliation.inReconfirmNotificationPeriod
          ).to.equal(false)
          expect(
            fullEmails[2].affiliation.inReconfirmNotificationPeriod
          ).to.equal(false)
        })
      })

      it('should flag to show notification if v1 shows as past reconfirmation but v2 does not', async function () {
        const email = 'abc123@test.com'
        const confirmedAt = new Date()
        const affiliationsData = [
          {
            email,
            licence: 'free',
            institution: institutionNonSSO,
            last_day_to_reconfirm: '2020-07-11T18:25:01.639Z',
            past_reconfirm_date: true,
          },
        ]
        const user = {
          _id: '12390i',
          email,
          emails: [
            {
              email,
              confirmedAt,
              default: true,
            },
          ],
        }
        this.getUserAffiliations.resolves(affiliationsData)
        this.UserGetter.promises.getUser = sinon.stub().resolves(user)
        const fullEmails = await this.UserGetter.promises.getUserFullEmails(
          this.fakeUser._id
        )
        expect(
          fullEmails[0].affiliation.inReconfirmNotificationPeriod
        ).to.equal(true)
      })

      it('should flag to show notification if v1 shows as reconfirmation upcoming but v2 does not', async function () {
        const email = 'abc123@test.com'
        const { maxConfirmationMonths } = institutionNonSSO
        const affiliationsData = [
          {
            email,
            licence: 'free',
            institution: institutionNonSSO,
            last_day_to_reconfirm: moment()
              .subtract(maxConfirmationMonths, 'months')
              .add(3, 'day')
              .toDate(),
          },
        ]
        const user = {
          _id: '12390i',
          email,
          emails: [
            {
              email,
              confirmedAt: new Date(),
              default: true,
            },
          ],
        }
        this.getUserAffiliations.resolves(affiliationsData)
        this.UserGetter.promises.getUser = sinon.stub().resolves(user)
        const fullEmails = await this.UserGetter.promises.getUserFullEmails(
          this.fakeUser._id
        )
        expect(
          fullEmails[0].affiliation.inReconfirmNotificationPeriod
        ).to.equal(true)
      })

      it('should flag to show notification if v2 shows as reconfirmation upcoming but v1 does not', async function () {
        const email = 'abc123@test.com'
        const { maxConfirmationMonths } = institutionNonSSO

        const datePastReconfirmation = moment()
          .subtract(maxConfirmationMonths, 'months')
          .add(3, 'day')
          .toDate()

        const dateNotPastReconfirmation = moment().add(1, 'month').toDate()

        const affiliationsData = [
          {
            email,
            licence: 'free',
            institution: institutionNonSSO,
            last_day_to_reconfirm: dateNotPastReconfirmation,
          },
        ]
        const user = {
          _id: '12390i',
          email,
          emails: [
            {
              email,
              confirmedAt: datePastReconfirmation,
              default: true,
            },
          ],
        }
        this.getUserAffiliations.resolves(affiliationsData)
        this.UserGetter.promises.getUser = sinon.stub().resolves(user)
        const fullEmails = await this.UserGetter.promises.getUserFullEmails(
          this.fakeUser._id
        )
        expect(
          fullEmails[0].affiliation.inReconfirmNotificationPeriod
        ).to.equal(true)
      })

      describe('cachedLastDayToReconfirm', function () {
        const email = 'abc123@test.com'
        const confirmedAt = new Date('2019-07-11T18:25:01.639Z')
        const lastDay = '2020-07-11T18:25:01.639Z'
        const affiliationsData = [
          {
            email,
            licence: 'professional',
            institution: institutionSSO,
            last_day_to_reconfirm: lastDay,
            past_reconfirm_date: true,
          },
        ]
        const user = {
          _id: '12390i',
          email,
          emails: [
            {
              email,
              confirmedAt,
              default: true,
            },
          ],
        }

        it('should set cachedLastDayToReconfirm for SSO institutions if email is linked to SSO', async function () {
          const userLinked = Object.assign({}, user)
          userLinked.emails[0].samlProviderId = institutionSSO.id.toString()
          this.getUserAffiliations.resolves(affiliationsData)
          this.UserGetter.promises.getUser = sinon.stub().resolves(userLinked)
          const fullEmails = await this.UserGetter.promises.getUserFullEmails(
            this.fakeUser._id
          )
          expect(fullEmails[0].affiliation.cachedLastDayToReconfirm).to.equal(
            lastDay
          )
        })

        it('should NOT set cachedLastDayToReconfirm for SSO institutions if email is NOT linked to SSO', async function () {
          this.getUserAffiliations.resolves(affiliationsData)
          this.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await this.UserGetter.promises.getUserFullEmails(
            this.fakeUser._id
          )
          expect(fullEmails[0].affiliation.cachedLastDayToReconfirm).to.equal(
            lastDay
          )
        })

        it('should set cachedLastDayToReconfirm for non-SSO institutions', async function () {
          this.getUserAffiliations.resolves(affiliationsData)
          this.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await this.UserGetter.promises.getUserFullEmails(
            this.fakeUser._id
          )
          expect(fullEmails[0].affiliation.cachedLastDayToReconfirm).to.equal(
            lastDay
          )
        })
      })
    })

    describe('caching full emails data if run inside AsyncLocalStorage context', function () {
      it('should store the data in the AsyncLocalStorage store', async function () {
        this.store = {}
        this.AsyncLocalStorage.storage.getStore.returns(this.store)
        this.UserGetter.promises.getUser = sinon.stub().resolves(this.fakeUser)
        this.getUserAffiliations.resolves([
          {
            email: 'email1@foo.bar',
            licence: 'professional',
            institution: {},
          },
        ])
        const fullEmails = await this.UserGetter.promises.getUserFullEmails(
          this.fakeUser._id
        )
        expect(this.UserGetter.promises.getUser).to.have.been.calledOnce
        expect(this.getUserAffiliations).to.have.been.calledOnce
        expect(fullEmails).to.be.an('array')
        expect(fullEmails.length).to.equal(2)
        expect(this.store.userFullEmails[this.fakeUser._id]).to.deep.equal(
          fullEmails
        )
      })

      it('should fetch data from the store if available', async function () {
        this.store = {
          userFullEmails: {
            [this.fakeUser._id]: [{ email: '1' }, { email: '2' }],
          },
        }
        this.AsyncLocalStorage.storage.getStore.returns(this.store)
        this.UserGetter.promises.getUser = sinon.stub().resolves(this.fakeUser)
        const fullEmails = await this.UserGetter.promises.getUserFullEmails(
          this.fakeUser._id,
          this.req
        )
        expect(this.UserGetter.promises.getUser).to.not.have.been.called
        expect(this.getUserAffiliations).to.not.have.been.called
        expect(fullEmails).to.be.an('array')
        expect(fullEmails.length).to.equal(2)
        expect(this.store.userFullEmails[this.fakeUser._id]).to.deep.equal(
          fullEmails
        )
      })

      it('should not return cached data for different user ids', async function () {
        this.store = {}
        this.AsyncLocalStorage.storage.getStore.returns(this.store)
        this.UserGetter.promises.getUser = sinon.stub().resolves(this.fakeUser)
        const fullEmails = await this.UserGetter.promises.getUserFullEmails(
          this.fakeUser._id,
          this.req
        )
        expect(this.UserGetter.promises.getUser).to.have.been.calledOnce
        expect(this.getUserAffiliations).to.have.been.calledOnce
        expect(fullEmails).to.be.an('array')
        expect(fullEmails.length).to.equal(2)
        this.otherUser = {
          _id: new ObjectId(),
          email: 'other@foo.bar',
          emails: [
            {
              email: 'other@foo.bar',
              reversedHostname: 'rab.oof',
              confirmedAt: new Date(),
              lastConfirmedAt: new Date(),
            },
          ],
        }
        this.UserGetter.promises.getUser.resolves(this.otherUser)
        this.getUserAffiliations.resolves([
          {
            email: 'other@foo.bar',
            licence: 'professional',
            institution: {},
          },
        ])
        const fullEmailsOther =
          await this.UserGetter.promises.getUserFullEmails(
            this.otherUser._id,
            this.req
          )
        expect(this.UserGetter.promises.getUser).to.have.been.calledTwice
        expect(this.getUserAffiliations).to.have.been.calledTwice
        expect(fullEmailsOther).to.not.deep.equal(fullEmails)
        expect(fullEmailsOther).to.be.an('array')
        expect(fullEmailsOther.length).to.equal(1)
        expect(this.store.userFullEmails[this.fakeUser._id]).to.deep.equal(
          fullEmails
        )
        expect(this.store.userFullEmails[this.otherUser._id]).to.deep.equal(
          fullEmailsOther
        )
      })
    })
  })

  describe('getUserConfirmedEmails', function () {
    beforeEach(function () {
      this.fakeUser = {
        emails: [
          {
            email: 'email1@foo.bar',
            reversedHostname: 'rab.oof',
            confirmedAt: new Date(),
          },
          { email: 'email2@foo.bar', reversedHostname: 'rab.oof' },
          {
            email: 'email3@foo.bar',
            reversedHostname: 'rab.oof',
            confirmedAt: new Date(),
          },
        ],
      }
      this.UserGetter.promises.getUser = sinon.stub().resolves(this.fakeUser)
    })

    it('should get user', async function () {
      const projection = { emails: 1 }
      await this.UserGetter.promises.getUserConfirmedEmails(this.fakeUser._id)

      this.UserGetter.promises.getUser
        .calledWith(this.fakeUser._id, projection)
        .should.equal(true)
    })

    it('should return only confirmed emails', async function () {
      const confirmedEmails =
        await this.UserGetter.promises.getUserConfirmedEmails(this.fakeUser._id)

      expect(confirmedEmails.length).to.equal(2)
      expect(confirmedEmails[0].email).to.equal('email1@foo.bar')
      expect(confirmedEmails[1].email).to.equal('email3@foo.bar')
    })
  })

  describe('getUserbyMainEmail', function () {
    it('query user by main email', async function () {
      const email = 'hello@world.com'
      const projection = { emails: 1 }
      await this.UserGetter.promises.getUserByMainEmail(email, projection)
      this.findOne.called.should.equal(true)
      this.findOne.calledWith({ email }, { projection }).should.equal(true)
    })

    it('return user if found', async function () {
      const email = 'hello@world.com'
      const user = await this.UserGetter.promises.getUserByMainEmail(email)
      user.should.deep.equal(this.fakeUser)
    })

    it('trim email', async function () {
      const email = 'hello@world.com'
      await this.UserGetter.promises.getUserByMainEmail(` ${email} `)
      this.findOne.called.should.equal(true)
      this.findOne.calledWith({ email }).should.equal(true)
    })
  })

  describe('getUserByAnyEmail', function () {
    it('query user for any email', async function () {
      const email = 'hello@world.com'
      const expectedQuery = {
        emails: { $exists: true },
        'emails.email': email,
      }
      const projection = { emails: 1 }
      const user = await this.UserGetter.promises.getUserByAnyEmail(
        ` ${email} `,
        projection
      )
      this.findOne.calledWith(expectedQuery, { projection }).should.equal(true)
      user.should.deep.equal(this.fakeUser)
    })

    it('query contains $exists:true so partial index is used', async function () {
      const expectedQuery = {
        emails: { $exists: true },
        'emails.email': '',
      }
      await this.UserGetter.promises.getUserByAnyEmail('', {})
      this.findOne
        .calledWith(expectedQuery, { projection: {} })
        .should.equal(true)
    })

    it('checks main email as well', async function () {
      this.findOne.resolves(null)
      const email = 'hello@world.com'
      const projection = { emails: 1 }
      await this.UserGetter.promises.getUserByAnyEmail(` ${email} `, projection)
      this.findOne.calledTwice.should.equal(true)
      this.findOne.calledWith({ email }, { projection }).should.equal(true)
    })
  })

  describe('getUsersByHostname', function () {
    it('should find user by hostname', async function () {
      const hostname = 'bar.foo'
      const expectedQuery = {
        emails: { $exists: true },
        'emails.reversedHostname': hostname.split('').reverse().join(''),
      }
      const projection = { emails: 1 }
      await this.UserGetter.promises.getUsersByHostname(hostname, projection)
      this.find.calledOnce.should.equal(true)
      this.find.calledWith(expectedQuery, { projection }).should.equal(true)
    })
  })

  describe('getUsersByAnyConfirmedEmail', function () {
    it('should find users by confirmed email', async function () {
      const emails = ['confirmed@example.com']

      await this.UserGetter.promises.getUsersByAnyConfirmedEmail(emails)
      expect(this.find).to.be.calledOnceWith(
        {
          'emails.email': { $in: emails }, // use the index on emails.email
          emails: {
            $exists: true,
            $elemMatch: {
              email: { $in: emails },
              confirmedAt: { $exists: true },
            },
          },
        },
        { projection: {} }
      )
    })
  })

  describe('getUsersByV1Id', function () {
    it('should find users by list of v1 ids', async function () {
      const v1Ids = [501]
      const expectedQuery = {
        'overleaf.id': { $in: v1Ids },
      }
      const projection = { emails: 1 }
      await this.UserGetter.promises.getUsersByV1Ids(v1Ids, projection)
      this.find.calledOnce.should.equal(true)
      this.find.calledWith(expectedQuery, { projection }).should.equal(true)
    })
  })

  describe('ensureUniqueEmailAddress', function () {
    beforeEach(function () {
      this.UserGetter.promises.getUserByAnyEmail = sinon.stub()
    })

    it('should return error if existing user is found', async function () {
      this.UserGetter.promises.getUserByAnyEmail.resolves(this.fakeUser)
      await expect(
        this.UserGetter.promises.ensureUniqueEmailAddress(this.newEmail)
      ).to.be.rejectedWith(Errors.EmailExistsError)
    })

    it('should return null if no user is found', async function () {
      this.UserGetter.promises.getUserByAnyEmail.resolves(null)
      await expect(
        this.UserGetter.promises.ensureUniqueEmailAddress(this.newEmail)
      ).to.be.fulfilled
    })
  })

  describe('getUserFeatures', function () {
    beforeEach(function () {
      this.Modules.promises.hooks.fire = sinon.stub().resolves()
      this.fakeUser.features = {}
    })

    it('should return user features', async function () {
      this.fakeUser.features = { feature1: true, feature2: false }
      const features = await this.UserGetter.promises.getUserFeatures(
        new ObjectId()
      )
      expect(features).to.deep.equal(this.fakeUser.features)
    })

    it('should return user features when using promises', async function () {
      this.fakeUser.features = { feature1: true, feature2: false }
      const features = await this.UserGetter.promises.getUserFeatures(
        this.fakeUser._id
      )
      expect(features).to.deep.equal(this.fakeUser.features)
    })

    it('should take into account features overrides from modules', async function () {
      // this case occurs when the user has bought the ai bundle on WF, which should include our error assistant
      const bundleFeatures = { aiErrorAssistant: true }
      this.fakeUser.features = { aiErrorAssistant: false }
      this.Modules.promises.hooks.fire = sinon.stub().resolves([bundleFeatures])
      const features = await this.UserGetter.promises.getUserFeatures(
        this.fakeUser._id
      )
      expect(features).to.deep.equal(bundleFeatures)
      this.Modules.promises.hooks.fire.should.have.been.calledWith(
        'getModuleProvidedFeatures',
        this.fakeUser._id
      )
    })

    it('should handle modules not returning any features', async function () {
      this.Modules.promises.hooks.fire = sinon.stub().resolves([])
      this.fakeUser.features = { test: true }
      const features = await this.UserGetter.promises.getUserFeatures(
        this.fakeUser._id
      )
      expect(features).to.deep.equal({ test: true })
      this.Modules.promises.hooks.fire.should.have.been.calledWith(
        'getModuleProvidedFeatures',
        this.fakeUser._id
      )
    })
  })
})
