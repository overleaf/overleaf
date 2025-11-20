import { vi, expect } from 'vitest'
import mongodb from 'mongodb-legacy'
import assert from 'node:assert'
import moment from 'moment'
import path from 'node:path'
import sinon from 'sinon'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import MongoHelpers from '../../../../app/src/Features/Helpers/Mongo.mjs'
const modulePath = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/User/UserGetter'
)
const { normalizeQuery, normalizeMultiQuery } = MongoHelpers

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

const { ObjectId } = mongodb

describe('UserGetter', function () {
  beforeEach(async function (ctx) {
    const confirmedAt = new Date()
    ctx.fakeUser = {
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
    ctx.findOne = sinon.stub().resolves(ctx.fakeUser)
    ctx.findToArrayStub = sinon.stub().resolves([ctx.fakeUser])
    ctx.find = sinon.stub().returns({ toArray: ctx.findToArrayStub })
    ctx.Mongo = {
      db: {
        users: {
          findOne: ctx.findOne,
          find: ctx.find,
        },
      },
      ObjectId,
    }
    ctx.getUserAffiliations = sinon.stub().resolves([])

    ctx.Modules = {
      promises: { hooks: { fire: sinon.stub().resolves() } },
    }
    ctx.AsyncLocalStorage = {
      storage: {
        getStore: sinon.stub().returns(undefined),
      },
    }

    vi.doMock('../../../../app/src/Features/Helpers/Mongo', () => ({
      default: { normalizeQuery, normalizeMultiQuery },
    }))

    vi.doMock('../../../../app/src/infrastructure/mongodb', () => ctx.Mongo)

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
        reconfirmNotificationDays: 14,
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/Institutions/InstitutionsAPI',
      () => ({
        default: {
          promises: {
            getUserAffiliations: ctx.getUserAffiliations,
          },
        },
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Features', () => ({
      default: {
        hasFeature: sinon.stub().returns(true),
      },
    }))

    vi.doMock('../../../../app/src/models/User', () => ({
      User: (ctx.User = {}),
    }))

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: ctx.Modules,
    }))

    vi.doMock('../../../../app/src/infrastructure/AsyncLocalStorage', () => ({
      default: ctx.AsyncLocalStorage,
    }))

    ctx.UserGetter = (await import(modulePath)).default
  })

  describe('getSsoUsersAtInstitution', function () {
    it('should throw an error when no projection is passed', async function (ctx) {
      await expect(
        ctx.UserGetter.promises.getSsoUsersAtInstitution(1, undefined)
      ).to.be.rejectedWith('missing projection')
    })
  })

  describe('getUser', function () {
    it('should get user', async function (ctx) {
      const query = { _id: '000000000000000000000000' }
      const projection = { email: 1 }
      const user = await ctx.UserGetter.promises.getUser(query, projection)
      ctx.findOne.called.should.equal(true)
      ctx.findOne.calledWith(query, { projection }).should.equal(true)
      expect(user).to.deep.equal(ctx.fakeUser)
    })

    it('should not allow null query', async function (ctx) {
      await expect(
        ctx.UserGetter.promises.getUser(null, {})
      ).to.be.rejectedWith('no query provided')
    })
  })

  describe('getUsers', function () {
    it('should get users with array of userIds', async function (ctx) {
      const query = [new ObjectId()]
      const projection = { email: 1 }
      const users = await ctx.UserGetter.promises.getUsers(query, projection)
      ctx.find.should.have.been.calledWithMatch(
        { _id: { $in: query } },
        { projection }
      )
      users.should.deep.equal([ctx.fakeUser])
    })

    it('should not call mongo with empty list', async function (ctx) {
      const query = []
      const projection = { email: 1 }
      const users = await ctx.UserGetter.promises.getUsers(query, projection)
      expect(users).to.deep.equal([])
      expect(ctx.find).to.not.have.been.called
    })

    it('should not allow null query', async function (ctx) {
      await expect(
        ctx.UserGetter.promises.getUsers(null, {})
      ).to.be.rejectedWith('no query provided')
    })
  })

  describe('getUserFullEmails', function () {
    it('should get user', async function (ctx) {
      ctx.UserGetter.promises.getUser = sinon.stub().resolves(ctx.fakeUser)
      const projection = { email: 1, emails: 1, samlIdentifiers: 1 }
      await ctx.UserGetter.promises.getUserFullEmails(ctx.fakeUser._id)
      ctx.UserGetter.promises.getUser.called.should.equal(true)
      ctx.UserGetter.promises.getUser
        .calledWith(ctx.fakeUser._id, projection)
        .should.equal(true)
    })

    it('should fetch emails data', async function (ctx) {
      ctx.UserGetter.promises.getUser = sinon.stub().resolves(ctx.fakeUser)
      const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
        ctx.fakeUser._id
      )

      assert.deepEqual(fullEmails, [
        {
          email: 'email1@foo.bar',
          reversedHostname: 'rab.oof',
          confirmedAt: ctx.fakeUser.emails[0].confirmedAt,
          lastConfirmedAt: ctx.fakeUser.emails[0].lastConfirmedAt,
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

    it('should merge affiliation data', async function (ctx) {
      ctx.UserGetter.promises.getUser = sinon.stub().resolves(ctx.fakeUser)
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
      ctx.getUserAffiliations.resolves(affiliationsData)
      const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
        ctx.fakeUser._id
      )

      assert.deepEqual(fullEmails, [
        {
          email: 'email1@foo.bar',
          reversedHostname: 'rab.oof',
          confirmedAt: ctx.fakeUser.emails[0].confirmedAt,
          lastConfirmedAt: ctx.fakeUser.emails[0].lastConfirmedAt,
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

    it('should merge SAML identifier', async function (ctx) {
      const fakeSamlIdentifiers = [
        { providerId: 'saml_id', externalUserId: 'whatever' },
      ]
      const fakeUserWithSaml = ctx.fakeUser
      fakeUserWithSaml.emails[0].samlProviderId = 'saml_id'
      fakeUserWithSaml.samlIdentifiers = fakeSamlIdentifiers
      ctx.UserGetter.promises.getUser = sinon.stub().resolves(ctx.fakeUser)
      ctx.getUserAffiliations.resolves([])
      const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
        ctx.fakeUser._id
      )

      assert.deepEqual(fullEmails, [
        {
          email: 'email1@foo.bar',
          reversedHostname: 'rab.oof',
          confirmedAt: ctx.fakeUser.emails[0].confirmedAt,
          lastConfirmedAt: ctx.fakeUser.emails[0].lastConfirmedAt,
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

    it('should get user when it has no emails field', async function (ctx) {
      ctx.fakeUserNoEmails = {
        _id: '12390i',
        email: 'email2@foo.bar',
      }
      ctx.UserGetter.promises.getUser = sinon
        .stub()
        .resolves(ctx.fakeUserNoEmails)
      const projection = { email: 1, emails: 1, samlIdentifiers: 1 }
      const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
        ctx.fakeUserNoEmails._id
      )
      ctx.UserGetter.promises.getUser.called.should.equal(true)
      ctx.UserGetter.promises.getUser
        .calledWith(ctx.fakeUserNoEmails._id, projection)
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
        it('should flag inReconfirmNotificationPeriod for all affiliations in period', async function (ctx) {
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
          ctx.getUserAffiliations.resolves(affiliations)
          ctx.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
            ctx.fakeUser._id
          )
          expect(
            fullEmails[0].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
          expect(
            fullEmails[1].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
        })

        it('should not flag affiliations outside of notification period', async function (ctx) {
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
          ctx.getUserAffiliations.resolves(affiliations)
          ctx.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
            ctx.fakeUser._id
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
        it('should flag only linked email, if in notification period', async function (ctx) {
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
          ctx.getUserAffiliations.resolves(affiliations)
          ctx.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
            ctx.fakeUser._id
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
        it('should flag each institution', async function (ctx) {
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

          ctx.getUserAffiliations.resolves(affiliationsData)
          ctx.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
            ctx.fakeUser._id
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
        it('only use confirmedAt when no reconfirmedAt', async function (ctx) {
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
          ctx.getUserAffiliations.resolves(affiliationsData)
          ctx.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
            ctx.fakeUser._id
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
        it('should flag the email', async function (ctx) {
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
          ctx.getUserAffiliations.resolves(affiliationsData)
          ctx.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
            ctx.fakeUser._id
          )
          expect(
            fullEmails[0].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
        })
      })

      describe('when no Settings.reconfirmNotificationDays', function () {
        it('should always return inReconfirmNotificationPeriod:false', async function (ctx) {
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
          ctx.settings.reconfirmNotificationDays = undefined
          ctx.getUserAffiliations.resolves(affiliationsData)
          ctx.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
            ctx.fakeUser._id
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

      it('should flag to show notification if v1 shows as past reconfirmation but v2 does not', async function (ctx) {
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
        ctx.getUserAffiliations.resolves(affiliationsData)
        ctx.UserGetter.promises.getUser = sinon.stub().resolves(user)
        const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
          ctx.fakeUser._id
        )
        expect(
          fullEmails[0].affiliation.inReconfirmNotificationPeriod
        ).to.equal(true)
      })

      it('should flag to show notification if v1 shows as reconfirmation upcoming but v2 does not', async function (ctx) {
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
        ctx.getUserAffiliations.resolves(affiliationsData)
        ctx.UserGetter.promises.getUser = sinon.stub().resolves(user)
        const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
          ctx.fakeUser._id
        )
        expect(
          fullEmails[0].affiliation.inReconfirmNotificationPeriod
        ).to.equal(true)
      })

      it('should flag to show notification if v2 shows as reconfirmation upcoming but v1 does not', async function (ctx) {
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
        ctx.getUserAffiliations.resolves(affiliationsData)
        ctx.UserGetter.promises.getUser = sinon.stub().resolves(user)
        const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
          ctx.fakeUser._id
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

        it('should set cachedLastDayToReconfirm for SSO institutions if email is linked to SSO', async function (ctx) {
          const userLinked = Object.assign({}, user)
          userLinked.emails[0].samlProviderId = institutionSSO.id.toString()
          ctx.getUserAffiliations.resolves(affiliationsData)
          ctx.UserGetter.promises.getUser = sinon.stub().resolves(userLinked)
          const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
            ctx.fakeUser._id
          )
          expect(fullEmails[0].affiliation.cachedLastDayToReconfirm).to.equal(
            lastDay
          )
        })

        it('should NOT set cachedLastDayToReconfirm for SSO institutions if email is NOT linked to SSO', async function (ctx) {
          ctx.getUserAffiliations.resolves(affiliationsData)
          ctx.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
            ctx.fakeUser._id
          )
          expect(fullEmails[0].affiliation.cachedLastDayToReconfirm).to.equal(
            lastDay
          )
        })

        it('should set cachedLastDayToReconfirm for non-SSO institutions', async function (ctx) {
          ctx.getUserAffiliations.resolves(affiliationsData)
          ctx.UserGetter.promises.getUser = sinon.stub().resolves(user)
          const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
            ctx.fakeUser._id
          )
          expect(fullEmails[0].affiliation.cachedLastDayToReconfirm).to.equal(
            lastDay
          )
        })
      })
    })

    describe('caching full emails data if run inside AsyncLocalStorage context', function () {
      it('should store the data in the AsyncLocalStorage store', async function (ctx) {
        ctx.store = {}
        ctx.AsyncLocalStorage.storage.getStore.returns(ctx.store)
        ctx.UserGetter.promises.getUser = sinon.stub().resolves(ctx.fakeUser)
        ctx.getUserAffiliations.resolves([
          {
            email: 'email1@foo.bar',
            licence: 'professional',
            institution: {},
          },
        ])
        const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
          ctx.fakeUser._id
        )
        expect(ctx.UserGetter.promises.getUser).to.have.been.calledOnce
        expect(ctx.getUserAffiliations).to.have.been.calledOnce
        expect(fullEmails).to.be.an('array')
        expect(fullEmails.length).to.equal(2)
        expect(ctx.store.userFullEmails[ctx.fakeUser._id]).to.deep.equal(
          fullEmails
        )
      })

      it('should fetch data from the store if available', async function (ctx) {
        ctx.store = {
          userFullEmails: {
            [ctx.fakeUser._id]: [{ email: '1' }, { email: '2' }],
          },
        }
        ctx.AsyncLocalStorage.storage.getStore.returns(ctx.store)
        ctx.UserGetter.promises.getUser = sinon.stub().resolves(ctx.fakeUser)
        const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
          ctx.fakeUser._id,
          ctx.req
        )
        expect(ctx.UserGetter.promises.getUser).to.not.have.been.called
        expect(ctx.getUserAffiliations).to.not.have.been.called
        expect(fullEmails).to.be.an('array')
        expect(fullEmails.length).to.equal(2)
        expect(ctx.store.userFullEmails[ctx.fakeUser._id]).to.deep.equal(
          fullEmails
        )
      })

      it('should not return cached data for different user ids', async function (ctx) {
        ctx.store = {}
        ctx.AsyncLocalStorage.storage.getStore.returns(ctx.store)
        ctx.UserGetter.promises.getUser = sinon.stub().resolves(ctx.fakeUser)
        const fullEmails = await ctx.UserGetter.promises.getUserFullEmails(
          ctx.fakeUser._id,
          ctx.req
        )
        expect(ctx.UserGetter.promises.getUser).to.have.been.calledOnce
        expect(ctx.getUserAffiliations).to.have.been.calledOnce
        expect(fullEmails).to.be.an('array')
        expect(fullEmails.length).to.equal(2)
        ctx.otherUser = {
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
        ctx.UserGetter.promises.getUser.resolves(ctx.otherUser)
        ctx.getUserAffiliations.resolves([
          {
            email: 'other@foo.bar',
            licence: 'professional',
            institution: {},
          },
        ])
        const fullEmailsOther = await ctx.UserGetter.promises.getUserFullEmails(
          ctx.otherUser._id,
          ctx.req
        )
        expect(ctx.UserGetter.promises.getUser).to.have.been.calledTwice
        expect(ctx.getUserAffiliations).to.have.been.calledTwice
        expect(fullEmailsOther).to.not.deep.equal(fullEmails)
        expect(fullEmailsOther).to.be.an('array')
        expect(fullEmailsOther.length).to.equal(1)
        expect(ctx.store.userFullEmails[ctx.fakeUser._id]).to.deep.equal(
          fullEmails
        )
        expect(ctx.store.userFullEmails[ctx.otherUser._id]).to.deep.equal(
          fullEmailsOther
        )
      })
    })
  })

  describe('getUserConfirmedEmails', function () {
    beforeEach(function (ctx) {
      ctx.fakeUser = {
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
      ctx.UserGetter.promises.getUser = sinon.stub().resolves(ctx.fakeUser)
    })

    it('should get user', async function (ctx) {
      const projection = { emails: 1 }
      await ctx.UserGetter.promises.getUserConfirmedEmails(ctx.fakeUser._id)

      ctx.UserGetter.promises.getUser
        .calledWith(ctx.fakeUser._id, projection)
        .should.equal(true)
    })

    it('should return only confirmed emails', async function (ctx) {
      const confirmedEmails =
        await ctx.UserGetter.promises.getUserConfirmedEmails(ctx.fakeUser._id)

      expect(confirmedEmails.length).to.equal(2)
      expect(confirmedEmails[0].email).to.equal('email1@foo.bar')
      expect(confirmedEmails[1].email).to.equal('email3@foo.bar')
    })
  })

  describe('getUserbyMainEmail', function () {
    it('query user by main email', async function (ctx) {
      const email = 'hello@world.com'
      const projection = { emails: 1 }
      await ctx.UserGetter.promises.getUserByMainEmail(email, projection)
      ctx.findOne.called.should.equal(true)
      ctx.findOne.calledWith({ email }, { projection }).should.equal(true)
    })

    it('return user if found', async function (ctx) {
      const email = 'hello@world.com'
      const user = await ctx.UserGetter.promises.getUserByMainEmail(email)
      user.should.deep.equal(ctx.fakeUser)
    })

    it('trim email', async function (ctx) {
      const email = 'hello@world.com'
      await ctx.UserGetter.promises.getUserByMainEmail(` ${email} `)
      ctx.findOne.called.should.equal(true)
      ctx.findOne.calledWith({ email }).should.equal(true)
    })
  })

  describe('getUserByAnyEmail', function () {
    it('query user for any email', async function (ctx) {
      const email = 'hello@world.com'
      const expectedQuery = {
        emails: { $exists: true },
        'emails.email': email,
      }
      const projection = { emails: 1 }
      const user = await ctx.UserGetter.promises.getUserByAnyEmail(
        ` ${email} `,
        projection
      )
      ctx.findOne.calledWith(expectedQuery, { projection }).should.equal(true)
      user.should.deep.equal(ctx.fakeUser)
    })

    it('query contains $exists:true so partial index is used', async function (ctx) {
      const expectedQuery = {
        emails: { $exists: true },
        'emails.email': '',
      }
      await ctx.UserGetter.promises.getUserByAnyEmail('', {})
      ctx.findOne
        .calledWith(expectedQuery, { projection: {} })
        .should.equal(true)
    })

    it('checks main email as well', async function (ctx) {
      ctx.findOne.resolves(null)
      const email = 'hello@world.com'
      const projection = { emails: 1 }
      await ctx.UserGetter.promises.getUserByAnyEmail(` ${email} `, projection)
      ctx.findOne.calledTwice.should.equal(true)
      ctx.findOne.calledWith({ email }, { projection }).should.equal(true)
    })
  })

  describe('getUsersByHostname', function () {
    it('should find user by hostname', async function (ctx) {
      const hostname = 'bar.foo'
      const expectedQuery = {
        emails: { $exists: true },
        'emails.reversedHostname': hostname.split('').reverse().join(''),
      }
      const projection = { emails: 1 }
      await ctx.UserGetter.promises.getUsersByHostname(hostname, projection)
      ctx.find.calledOnce.should.equal(true)
      ctx.find.calledWith(expectedQuery, { projection }).should.equal(true)
    })
  })

  describe('getUsersByAnyConfirmedEmail', function () {
    it('should find users by confirmed email', async function (ctx) {
      const emails = ['confirmed@example.com']

      await ctx.UserGetter.promises.getUsersByAnyConfirmedEmail(emails)
      expect(ctx.find).to.be.calledOnceWith(
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
    it('should find users by list of v1 ids', async function (ctx) {
      const v1Ids = [501]
      const expectedQuery = {
        'overleaf.id': { $in: v1Ids },
      }
      const projection = { emails: 1 }
      await ctx.UserGetter.promises.getUsersByV1Ids(v1Ids, projection)
      ctx.find.calledOnce.should.equal(true)
      ctx.find.calledWith(expectedQuery, { projection }).should.equal(true)
    })
  })

  describe('ensureUniqueEmailAddress', function () {
    beforeEach(function (ctx) {
      ctx.UserGetter.promises.getUserByAnyEmail = sinon.stub()
    })

    it('should return error if existing user is found', async function (ctx) {
      ctx.UserGetter.promises.getUserByAnyEmail.resolves(ctx.fakeUser)
      await expect(
        ctx.UserGetter.promises.ensureUniqueEmailAddress(ctx.newEmail)
      ).to.be.rejectedWith(Errors.EmailExistsError)
    })

    it('should return null if no user is found', async function (ctx) {
      ctx.UserGetter.promises.getUserByAnyEmail.resolves(null)
      await expect(
        ctx.UserGetter.promises.ensureUniqueEmailAddress(ctx.newEmail)
      ).to.be.fulfilled
    })
  })

  describe('getUserFeatures', function () {
    beforeEach(function (ctx) {
      ctx.Modules.promises.hooks.fire = sinon.stub().resolves()
      ctx.fakeUser.features = {}
    })

    it('should return user features', async function (ctx) {
      ctx.fakeUser.features = { feature1: true, feature2: false }
      const features = await ctx.UserGetter.promises.getUserFeatures(
        new ObjectId()
      )
      expect(features).to.deep.equal(ctx.fakeUser.features)
    })

    it('should return user features when using promises', async function (ctx) {
      ctx.fakeUser.features = { feature1: true, feature2: false }
      const features = await ctx.UserGetter.promises.getUserFeatures(
        ctx.fakeUser._id
      )
      expect(features).to.deep.equal(ctx.fakeUser.features)
    })

    it('should take into account features overrides from modules', async function (ctx) {
      // this case occurs when the user has bought the ai bundle on WF, which should include our error assistant
      const bundleFeatures = { aiErrorAssistant: true }
      ctx.fakeUser.features = { aiErrorAssistant: false }
      ctx.Modules.promises.hooks.fire = sinon.stub().resolves([bundleFeatures])
      const features = await ctx.UserGetter.promises.getUserFeatures(
        ctx.fakeUser._id
      )
      expect(features).to.deep.equal(bundleFeatures)
      ctx.Modules.promises.hooks.fire.should.have.been.calledWith(
        'getModuleProvidedFeatures',
        ctx.fakeUser._id
      )
    })

    it('should handle modules not returning any features', async function (ctx) {
      ctx.Modules.promises.hooks.fire = sinon.stub().resolves([])
      ctx.fakeUser.features = { test: true }
      const features = await ctx.UserGetter.promises.getUserFeatures(
        ctx.fakeUser._id
      )
      expect(features).to.deep.equal({ test: true })
      ctx.Modules.promises.hooks.fire.should.have.been.calledWith(
        'getModuleProvidedFeatures',
        ctx.fakeUser._id
      )
    })
  })
})
