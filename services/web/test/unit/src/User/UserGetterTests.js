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
      _id: '12390i',
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
    this.findOne = sinon.stub().callsArgWith(2, null, this.fakeUser)
    this.findToArrayStub = sinon.stub().yields(null, [this.fakeUser])
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
      },
    })
  })

  describe('getSsoUsersAtInstitution', function () {
    it('should throw an error when no projection is passed', function (done) {
      this.UserGetter.getSsoUsersAtInstitution(1, undefined, error => {
        expect(error).to.exist
        expect(error.message).to.equal('missing projection')
        done()
      })
    })
  })

  describe('getUser', function () {
    it('should get user', function (done) {
      const query = { _id: '000000000000000000000000' }
      const projection = { email: 1 }
      this.UserGetter.getUser(query, projection, (error, user) => {
        expect(error).to.not.exist
        this.findOne.called.should.equal(true)
        this.findOne.calledWith(query, { projection }).should.equal(true)
        user.should.deep.equal(this.fakeUser)
        done()
      })
    })

    it('should not allow null query', function (done) {
      this.UserGetter.getUser(null, {}, error => {
        error.should.exist
        error.message.should.equal('no query provided')
        done()
      })
    })
  })

  describe('getUsers', function () {
    it('should get users with array of userIds', function (done) {
      const query = [new ObjectId()]
      const projection = { email: 1 }
      this.UserGetter.getUsers(query, projection, (error, users) => {
        expect(error).to.not.exist
        this.find.should.have.been.calledWithMatch(
          { _id: { $in: query } },
          { projection }
        )
        users.should.deep.equal([this.fakeUser])
        done()
      })
    })

    it('should not allow null query', function (done) {
      this.UserGetter.getUser(null, {}, error => {
        error.should.exist
        error.message.should.equal('no query provided')
        done()
      })
    })
  })

  describe('getUserFullEmails', function () {
    it('should get user', function (done) {
      this.UserGetter.promises.getUser = sinon.stub().resolves(this.fakeUser)
      const projection = { email: 1, emails: 1, samlIdentifiers: 1 }
      this.UserGetter.getUserFullEmails(
        this.fakeUser._id,
        (error, fullEmails) => {
          expect(error).to.not.exist
          this.UserGetter.promises.getUser.called.should.equal(true)
          this.UserGetter.promises.getUser
            .calledWith(this.fakeUser._id, projection)
            .should.equal(true)
          done()
        }
      )
    })

    it('should fetch emails data', function (done) {
      this.UserGetter.promises.getUser = sinon.stub().resolves(this.fakeUser)
      this.UserGetter.getUserFullEmails(
        this.fakeUser._id,
        (error, fullEmails) => {
          expect(error).to.not.exist
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
          done()
        }
      )
    })

    it('should merge affiliation data', function (done) {
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
      this.UserGetter.getUserFullEmails(
        this.fakeUser._id,
        (error, fullEmails) => {
          expect(error).to.not.exist
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
          done()
        }
      )
    })

    it('should merge SAML identifier', function (done) {
      const fakeSamlIdentifiers = [
        { providerId: 'saml_id', exteranlUserId: 'whatever' },
      ]
      const fakeUserWithSaml = this.fakeUser
      fakeUserWithSaml.emails[0].samlProviderId = 'saml_id'
      fakeUserWithSaml.samlIdentifiers = fakeSamlIdentifiers
      this.UserGetter.promises.getUser = sinon.stub().resolves(this.fakeUser)
      this.getUserAffiliations.resolves([])
      this.UserGetter.getUserFullEmails(
        this.fakeUser._id,
        (error, fullEmails) => {
          expect(error).to.not.exist
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
          done()
        }
      )
    })

    it('should get user when it has no emails field', function (done) {
      this.fakeUser = {
        _id: '12390i',
        email: 'email2@foo.bar',
      }
      this.UserGetter.promises.getUser = sinon.stub().resolves(this.fakeUser)
      const projection = { email: 1, emails: 1, samlIdentifiers: 1 }
      this.UserGetter.getUserFullEmails(
        this.fakeUser._id,
        (error, fullEmails) => {
          expect(error).to.not.exist
          this.UserGetter.promises.getUser.called.should.equal(true)
          this.UserGetter.promises.getUser
            .calledWith(this.fakeUser._id, projection)
            .should.equal(true)
          assert.deepEqual(fullEmails, [])
          done()
        }
      )
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
        it('should flag inReconfirmNotificationPeriod for all affiliations in period', function (done) {
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
          this.UserGetter.getUserFullEmails(
            this.fakeUser._id,
            (error, fullEmails) => {
              expect(error).to.not.exist
              expect(
                fullEmails[0].affiliation.inReconfirmNotificationPeriod
              ).to.equal(true)
              expect(
                fullEmails[1].affiliation.inReconfirmNotificationPeriod
              ).to.equal(true)
              done()
            }
          )
        })
        // eslint-disable-next-line mocha/no-skipped-tests
        it.skip('should not flag affiliations outside of notification period', function (done) {
          const { maxConfirmationMonths } = institutionNonSSO
          const confirmed1 = new Date()
          const lastDayToReconfirm1 = moment(confirmed1)
            .add(maxConfirmationMonths, 'months')
            .toDate()
          const confirmed2 = moment()
            .subtract(maxConfirmationMonths, 'months')
            .add(15, 'days')
            .toDate() // expires in 15 days
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
          this.UserGetter.getUserFullEmails(
            this.fakeUser._id,
            (error, fullEmails) => {
              expect(error).to.not.exist
              expect(
                fullEmails[0].affiliation.inReconfirmNotificationPeriod
              ).to.equal(false)
              expect(
                fullEmails[1].affiliation.inReconfirmNotificationPeriod
              ).to.equal(false)
              done()
            }
          )
        })
      })

      describe('SSO institutions', function () {
        it('should flag only linked email, if in notification period', function (done) {
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
          this.UserGetter.getUserFullEmails(
            this.fakeUser._id,
            (error, fullEmails) => {
              expect(error).to.not.exist
              expect(
                fullEmails[0].affiliation.inReconfirmNotificationPeriod
              ).to.equal(false)
              expect(
                fullEmails[1].affiliation.inReconfirmNotificationPeriod
              ).to.equal(true)
              expect(
                fullEmails[2].affiliation.inReconfirmNotificationPeriod
              ).to.equal(false)
              done()
            }
          )
        })
      })

      describe('multiple institution affiliations', function () {
        it('should flag each institution', function (done) {
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
          this.UserGetter.getUserFullEmails(
            this.fakeUser._id,
            (error, fullEmails) => {
              expect(error).to.not.exist
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
              done()
            }
          )
        })
      })

      describe('reconfirmedAt', function () {
        it('only use confirmedAt when no reconfirmedAt', function (done) {
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
          this.UserGetter.getUserFullEmails(
            this.fakeUser._id,
            (error, fullEmails) => {
              expect(error).to.not.exist
              expect(
                fullEmails[0].affiliation.inReconfirmNotificationPeriod
              ).to.equal(true)
              expect(
                fullEmails[1].affiliation.inReconfirmNotificationPeriod
              ).to.equal(true)
              expect(
                fullEmails[2].affiliation.inReconfirmNotificationPeriod
              ).to.equal(true)
              done()
            }
          )
        })
      })

      describe('before reconfirmation period expires and within reconfirmation notification period', function () {
        const email = 'leonard@example-affiliation.com'
        it('should flag the email', function (done) {
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
          this.UserGetter.getUserFullEmails(
            this.fakeUser._id,
            (error, fullEmails) => {
              expect(error).to.not.exist
              expect(
                fullEmails[0].affiliation.inReconfirmNotificationPeriod
              ).to.equal(true)
              done()
            }
          )
        })
      })

      describe('when no Settings.reconfirmNotificationDays', function () {
        it('should always return inReconfirmNotificationPeriod:false', function (done) {
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
          this.UserGetter.getUserFullEmails(
            this.fakeUser._id,
            (error, fullEmails) => {
              expect(error).to.not.exist
              expect(
                fullEmails[0].affiliation.inReconfirmNotificationPeriod
              ).to.to.equal(false)
              expect(
                fullEmails[1].affiliation.inReconfirmNotificationPeriod
              ).to.equal(false)
              expect(
                fullEmails[2].affiliation.inReconfirmNotificationPeriod
              ).to.equal(false)
              done()
            }
          )
        })
      })

      it('should flag to show notification if v1 shows as past reconfirmation but v2 does not', function (done) {
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
        this.UserGetter.getUserFullEmails(
          this.fakeUser._id,
          (error, fullEmails) => {
            expect(error).to.not.exist
            expect(
              fullEmails[0].affiliation.inReconfirmNotificationPeriod
            ).to.equal(true)
            done()
          }
        )
      })

      it('should flag to show notification if v1 shows as reconfirmation upcoming but v2 does not', function (done) {
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
        this.UserGetter.getUserFullEmails(
          this.fakeUser._id,
          (error, fullEmails) => {
            expect(error).to.not.exist
            expect(
              fullEmails[0].affiliation.inReconfirmNotificationPeriod
            ).to.equal(true)
            done()
          }
        )
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
    it('query user by main email', function (done) {
      const email = 'hello@world.com'
      const projection = { emails: 1 }
      this.UserGetter.getUserByMainEmail(email, projection, (error, user) => {
        expect(error).to.not.exist
        this.findOne.called.should.equal(true)
        this.findOne.calledWith({ email }, { projection }).should.equal(true)
        done()
      })
    })

    it('return user if found', function (done) {
      const email = 'hello@world.com'
      this.UserGetter.getUserByMainEmail(email, (error, user) => {
        expect(error).to.not.exist
        user.should.deep.equal(this.fakeUser)
        done()
      })
    })

    it('trim email', function (done) {
      const email = 'hello@world.com'
      this.UserGetter.getUserByMainEmail(` ${email} `, (error, user) => {
        expect(error).to.not.exist
        this.findOne.called.should.equal(true)
        this.findOne.calledWith({ email }).should.equal(true)
        done()
      })
    })
  })

  describe('getUserByAnyEmail', function () {
    it('query user for any email', function (done) {
      const email = 'hello@world.com'
      const expectedQuery = {
        emails: { $exists: true },
        'emails.email': email,
      }
      const projection = { emails: 1 }
      this.UserGetter.getUserByAnyEmail(
        ` ${email} `,
        projection,
        (error, user) => {
          expect(error).to.not.exist
          this.findOne
            .calledWith(expectedQuery, { projection })
            .should.equal(true)
          user.should.deep.equal(this.fakeUser)
          done()
        }
      )
    })

    it('query contains $exists:true so partial index is used', function (done) {
      const expectedQuery = {
        emails: { $exists: true },
        'emails.email': '',
      }
      this.UserGetter.getUserByAnyEmail('', {}, (error, user) => {
        expect(error).to.not.exist
        this.findOne
          .calledWith(expectedQuery, { projection: {} })
          .should.equal(true)
        done()
      })
    })

    it('checks main email as well', function (done) {
      this.findOne.callsArgWith(2, null, null)
      const email = 'hello@world.com'
      const projection = { emails: 1 }
      this.UserGetter.getUserByAnyEmail(
        ` ${email} `,
        projection,
        (error, user) => {
          expect(error).to.not.exist
          this.findOne.calledTwice.should.equal(true)
          this.findOne.calledWith({ email }, { projection }).should.equal(true)
          done()
        }
      )
    })
  })

  describe('getUsersByHostname', function () {
    it('should find user by hostname', function (done) {
      const hostname = 'bar.foo'
      const expectedQuery = {
        emails: { $exists: true },
        'emails.reversedHostname': hostname.split('').reverse().join(''),
      }
      const projection = { emails: 1 }
      this.UserGetter.getUsersByHostname(
        hostname,
        projection,
        (error, users) => {
          expect(error).to.not.exist
          this.find.calledOnce.should.equal(true)
          this.find.calledWith(expectedQuery, { projection }).should.equal(true)
          done()
        }
      )
    })
  })

  describe('getUsersByAnyConfirmedEmail', function () {
    it('should find users by confirmed email', function (done) {
      const emails = ['confirmed@example.com']

      this.UserGetter.getUsersByAnyConfirmedEmail(emails, (error, users) => {
        expect(error).to.not.exist
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
        done()
      })
    })
  })

  describe('getUsersByV1Id', function () {
    it('should find users by list of v1 ids', function (done) {
      const v1Ids = [501]
      const expectedQuery = {
        'overleaf.id': { $in: v1Ids },
      }
      const projection = { emails: 1 }
      this.UserGetter.getUsersByV1Ids(v1Ids, projection, (error, users) => {
        expect(error).to.not.exist
        this.find.calledOnce.should.equal(true)
        this.find.calledWith(expectedQuery, { projection }).should.equal(true)
        done()
      })
    })
  })

  describe('ensureUniqueEmailAddress', function () {
    beforeEach(function () {
      this.UserGetter.getUserByAnyEmail = sinon.stub()
    })

    it('should return error if existing user is found', function (done) {
      this.UserGetter.getUserByAnyEmail.callsArgWith(1, null, this.fakeUser)
      this.UserGetter.ensureUniqueEmailAddress(this.newEmail, err => {
        expect(err).to.exist
        expect(err).to.be.an.instanceof(Errors.EmailExistsError)
        done()
      })
    })

    it('should return null if no user is found', function (done) {
      this.UserGetter.getUserByAnyEmail.callsArgWith(1)
      this.UserGetter.ensureUniqueEmailAddress(this.newEmail, err => {
        expect(err).not.to.exist
        done()
      })
    })
  })
})
