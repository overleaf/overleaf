const { ObjectId } = require('mongodb')
const should = require('chai').should()
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
  normalizeMultiQuery
} = require('../../../../app/src/Features/Helpers/Mongo')

describe('UserGetter', function() {
  beforeEach(function() {
    this.fakeUser = {
      _id: '12390i',
      email: 'email2@foo.bar',
      emails: [
        {
          email: 'email1@foo.bar',
          reversedHostname: 'rab.oof',
          confirmedAt: new Date()
        },
        { email: 'email2@foo.bar', reversedHostname: 'rab.oof' }
      ]
    }
    this.findOne = sinon.stub().callsArgWith(2, null, this.fakeUser)
    this.findToArrayStub = sinon.stub().yields(null, [this.fakeUser])
    this.find = sinon.stub().returns({ toArray: this.findToArrayStub })
    this.Mongo = {
      db: {
        users: {
          findOne: this.findOne,
          find: this.find
        }
      },
      ObjectId
    }
    this.getUserAffiliations = sinon.stub().resolves([])

    this.UserGetter = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../Helpers/Mongo': { normalizeQuery, normalizeMultiQuery },
        'logger-sharelatex': {
          log() {}
        },
        '../../infrastructure/mongodb': this.Mongo,
        '@overleaf/metrics': {
          timeAsyncMethod: sinon.stub()
        },
        'settings-sharelatex': (this.settings = {
          reconfirmNotificationDays: 14
        }),
        '../Institutions/InstitutionsAPI': {
          promises: {
            getUserAffiliations: this.getUserAffiliations
          }
        },
        '../../infrastructure/Features': {
          hasFeature: sinon.stub().returns(true)
        }
      }
    })
  })

  describe('getUser', function() {
    it('should get user', function(done) {
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

    it('should not allow null query', function(done) {
      this.UserGetter.getUser(null, {}, error => {
        error.should.exist
        error.message.should.equal('no query provided')
        done()
      })
    })
  })

  describe('getUsers', function() {
    it('should get users with array of userIds', function(done) {
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

    it('should not allow null query', function(done) {
      this.UserGetter.getUser(null, {}, error => {
        error.should.exist
        error.message.should.equal('no query provided')
        done()
      })
    })
  })

  describe('getUserFullEmails', function() {
    it('should get user', function(done) {
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

    it('should fetch emails data', function(done) {
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
              emailHasInstitutionLicence: false,
              default: false
            },
            {
              email: 'email2@foo.bar',
              reversedHostname: 'rab.oof',
              emailHasInstitutionLicence: false,
              default: true
            }
          ])
          done()
        }
      )
    })

    it('should merge affiliation data', function(done) {
      this.UserGetter.promises.getUser = sinon.stub().resolves(this.fakeUser)
      const affiliationsData = [
        {
          email: 'email1@foo.bar',
          role: 'Prof',
          department: 'Maths',
          inferred: false,
          licence: 'pro_plus',
          institution: {
            name: 'University Name',
            isUniversity: true,
            confirmed: true
          },
          portal: undefined
        }
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
              default: false,
              emailHasInstitutionLicence: true,
              affiliation: {
                institution: affiliationsData[0].institution,
                inferred: affiliationsData[0].inferred,
                department: affiliationsData[0].department,
                role: affiliationsData[0].role,
                licence: affiliationsData[0].licence,
                inReconfirmNotificationPeriod: false,
                portal: undefined
              }
            },
            {
              email: 'email2@foo.bar',
              reversedHostname: 'rab.oof',
              emailHasInstitutionLicence: false,
              default: true
            }
          ])
          done()
        }
      )
    })

    it('should merge SAML identifier', function(done) {
      const fakeSamlIdentifiers = [
        { providerId: 'saml_id', exteranlUserId: 'whatever' }
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
              default: false,
              emailHasInstitutionLicence: false,
              samlProviderId: 'saml_id',
              samlIdentifier: fakeSamlIdentifiers[0]
            },
            {
              email: 'email2@foo.bar',
              reversedHostname: 'rab.oof',
              emailHasInstitutionLicence: false,
              default: true
            }
          ])
          done()
        }
      )
    })

    it('should get user when it has no emails field', function(done) {
      this.fakeUser = {
        _id: '12390i',
        email: 'email2@foo.bar'
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

    describe('affiliation reconfirmation', function() {
      const institutionNonSSO = {
        id: 1,
        name: 'University Name',
        commonsAccount: true,
        isUniversity: true,
        confirmed: true,
        ssoBeta: false,
        ssoEnabled: false,
        maxConfirmationMonths: 12
      }
      const institutionSSO = {
        id: 2,
        name: 'SSO University Name',
        isUniversity: true,
        confirmed: true,
        ssoBeta: false,
        ssoEnabled: true,
        maxConfirmationMonths: 12
      }
      describe('non-SSO institutions', function() {
        const email1 = 'leonard@example-affiliation.com'
        const email2 = 'mccoy@example-affiliation.com'
        const affiliationsData = [
          {
            email: email1,
            role: 'Prof',
            department: 'Medicine',
            inferred: false,
            licence: 'pro_plus',
            institution: institutionNonSSO
          },
          {
            email: email2,
            role: 'Prof',
            department: 'Medicine',
            inferred: false,
            licence: 'pro_plus',
            institution: institutionNonSSO
          }
        ]
        it('should flag inReconfirmNotificationPeriod for all affiliations in period', function(done) {
          const user = {
            _id: '12390i',
            email: email1,
            emails: [
              {
                email: email1,
                reversedHostname: 'moc.noitailiffa-elpmaxe',
                confirmedAt: moment()
                  .subtract(
                    institutionNonSSO.maxConfirmationMonths + 2,
                    'months'
                  )
                  .toDate(),
                default: true
              },
              {
                email: email2,
                reversedHostname: 'moc.noitailiffa-elpmaxe',
                confirmedAt: moment()
                  .subtract(
                    institutionNonSSO.maxConfirmationMonths + 1,
                    'months'
                  )
                  .toDate()
              }
            ]
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
              done()
            }
          )
        })
        it('should not flag affiliations outside of notification period', function(done) {
          const aboutToBeWithinPeriod = moment()
            .subtract(institutionNonSSO.maxConfirmationMonths, 'months')
            .add(15, 'days')
            .toDate() // expires in 15 days
          const user = {
            _id: '12390i',
            email: email1,
            emails: [
              {
                email: email1,
                reversedHostname: 'moc.noitailiffa-elpmaxe',
                confirmedAt: new Date(),
                default: true
              },
              {
                email: email2,
                reversedHostname: 'moc.noitailiffa-elpmaxe',
                confirmedAt: aboutToBeWithinPeriod
              }
            ]
          }
          this.getUserAffiliations.resolves(affiliationsData)
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

      describe('SSO institutions', function() {
        it('should flag only linked email, if in notification period', function(done) {
          const email1 = 'email1@sso.bar'
          const email2 = 'email2@sso.bar'
          const email3 = 'email3@sso.bar'

          const affiliationsData = [
            {
              email: email1,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionSSO
            },
            {
              email: email2,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionSSO
            },
            {
              email: email3,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionSSO
            }
          ]

          const user = {
            _id: '12390i',
            email: email1,
            emails: [
              {
                email: email1,
                reversedHostname: 'rab.oss',
                confirmedAt: new Date('2019-09-24'),
                reconfirmedAt: new Date('2019-09-24'),
                default: true
              },
              {
                email: email2,
                reversedHostname: 'rab.oss',
                confirmedAt: new Date('2019-09-24'),
                reconfirmedAt: new Date('2019-09-24'),
                samlProviderId: institutionSSO.id
              },
              {
                email: email3,
                reversedHostname: 'rab.oss',
                confirmedAt: new Date('2019-09-24'),
                reconfirmedAt: new Date('2019-09-24')
              }
            ],
            samlIdentifiers: [
              {
                providerId: institutionSSO.id,
                externalUserId: 'abc123'
              }
            ]
          }
          this.getUserAffiliations.resolves(affiliationsData)
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

      describe('multiple institution affiliations', function() {
        it('should flag each institution', function(done) {
          const email1 = 'email1@sso.bar'
          const email2 = 'email2@sso.bar'
          const email3 = 'email3@foo.bar'
          const email4 = 'email4@foo.bar'

          const affiliationsData = [
            {
              email: email1,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionSSO
            },
            {
              email: email2,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionSSO
            },
            {
              email: email3,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionNonSSO
            },
            {
              email: email4,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionNonSSO
            }
          ]
          const user = {
            _id: '12390i',
            email: email1,
            emails: [
              {
                email: email1,
                reversedHostname: 'rab.oss',
                confirmedAt: '2019-09-24T20:25:08.503Z',
                default: true
              },
              {
                email: email2,
                reversedHostname: 'rab.oss',
                confirmedAt: new Date('2019-09-24T20:25:08.503Z'),
                samlProviderId: institutionSSO.id
              },
              {
                email: email3,
                reversedHostname: 'rab.oof',
                confirmedAt: new Date('2019-10-24T20:25:08.503Z')
              },
              {
                email: email4,
                reversedHostname: 'rab.oof',
                confirmedAt: new Date('2019-09-24T20:25:08.503Z')
              }
            ],
            samlIdentifiers: [
              {
                providerId: institutionSSO.id,
                externalUserId: 'abc123'
              }
            ]
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

      describe('reconfirmedAt', function() {
        it('only use confirmedAt when no reconfirmedAt', function(done) {
          const email1 = 'email1@foo.bar'
          const email2 = 'email2@foo.bar'
          const email3 = 'email3@foo.bar'

          const affiliationsData = [
            {
              email: email1,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionNonSSO
            },
            {
              email: email2,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionNonSSO
            },
            {
              email: email3,
              role: 'Prof',
              department: 'Maths',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionNonSSO
            }
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
                reconfirmedAt: moment().subtract(
                  institutionSSO.maxConfirmationMonths * 3,
                  'months'
                ),
                default: true
              },
              {
                email: email2,
                reversedHostname: 'rab.oof',
                confirmedAt: moment().subtract(
                  institutionSSO.maxConfirmationMonths * 3,
                  'months'
                ),
                reconfirmedAt: moment().subtract(
                  institutionSSO.maxConfirmationMonths * 2,
                  'months'
                )
              },
              {
                email: email3,
                reversedHostname: 'rab.oof',
                confirmedAt: moment().subtract(
                  institutionSSO.maxConfirmationMonths * 4,
                  'months'
                ),
                reconfirmedAt: moment().subtract(
                  institutionSSO.maxConfirmationMonths * 4,
                  'months'
                )
              }
            ]
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

      describe('before reconfirmation period expires and within reconfirmation notification period', function() {
        const email = 'leonard@example-affiliation.com'
        it('should flag the email', function(done) {
          const confirmedAt = moment()
            .subtract(institutionNonSSO.maxConfirmationMonths, 'months')
            .subtract(14, 'days')
            .toDate() // expires in 14 days
          const affiliationsData = [
            {
              email,
              role: 'Prof',
              department: 'Medicine',
              inferred: false,
              licence: 'pro_plus',
              institution: institutionNonSSO
            }
          ]
          const user = {
            _id: '12390i',
            email,
            emails: [
              {
                email,
                confirmedAt,
                default: true
              }
            ]
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

      describe('when no Settings.reconfirmNotificationDays', function() {
        it('should always return inReconfirmNotificationPeriod:false', function(done) {
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
              institution: institutionSSO
            },
            {
              email: email2,
              institution: institutionNonSSO
            },
            {
              email: email3,
              institution: institutionNonSSO
            }
          ]
          const user = {
            _id: '12390i',
            email: email1,
            emails: [
              {
                email: email1,
                confirmedAt: confirmedAtAboutToExpire,
                default: true,
                samlProviderId: institutionSSO.id
              },
              {
                email: email2,
                confirmedAt: new Date('2019-09-24T20:25:08.503Z')
              },
              {
                email: email3,
                confirmedAt: new Date('2019-10-24T20:25:08.503Z')
              }
            ],
            samlIdentifiers: [
              {
                providerId: institutionSSO.id,
                externalUserId: 'abc123'
              }
            ]
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
    })
  })

  describe('getUserbyMainEmail', function() {
    it('query user by main email', function(done) {
      const email = 'hello@world.com'
      const projection = { emails: 1 }
      this.UserGetter.getUserByMainEmail(email, projection, (error, user) => {
        expect(error).to.not.exist
        this.findOne.called.should.equal(true)
        this.findOne.calledWith({ email }, { projection }).should.equal(true)
        done()
      })
    })

    it('return user if found', function(done) {
      const email = 'hello@world.com'
      this.UserGetter.getUserByMainEmail(email, (error, user) => {
        expect(error).to.not.exist
        user.should.deep.equal(this.fakeUser)
        done()
      })
    })

    it('trim email', function(done) {
      const email = 'hello@world.com'
      this.UserGetter.getUserByMainEmail(` ${email} `, (error, user) => {
        expect(error).to.not.exist
        this.findOne.called.should.equal(true)
        this.findOne.calledWith({ email }).should.equal(true)
        done()
      })
    })
  })

  describe('getUserByAnyEmail', function() {
    it('query user for any email', function(done) {
      const email = 'hello@world.com'
      const expectedQuery = {
        emails: { $exists: true },
        'emails.email': email
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

    it('query contains $exists:true so partial index is used', function(done) {
      const expectedQuery = {
        emails: { $exists: true },
        'emails.email': ''
      }
      this.UserGetter.getUserByAnyEmail('', {}, (error, user) => {
        expect(error).to.not.exist
        this.findOne
          .calledWith(expectedQuery, { projection: {} })
          .should.equal(true)
        done()
      })
    })

    it('checks main email as well', function(done) {
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

  describe('getUsersByHostname', function() {
    it('should find user by hostname', function(done) {
      const hostname = 'bar.foo'
      const expectedQuery = {
        emails: { $exists: true },
        'emails.reversedHostname': hostname
          .split('')
          .reverse()
          .join('')
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

  describe('getUsersByAnyConfirmedEmail', function() {
    it('should find users by confirmed email', function(done) {
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
                confirmedAt: { $exists: true }
              }
            }
          },
          { projection: {} }
        )
        done()
      })
    })
  })

  describe('getUsersByV1Id', function() {
    it('should find users by list of v1 ids', function(done) {
      const v1Ids = [501]
      const expectedQuery = {
        'overleaf.id': { $in: v1Ids }
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

  describe('ensureUniqueEmailAddress', function() {
    beforeEach(function() {
      this.UserGetter.getUserByAnyEmail = sinon.stub()
    })

    it('should return error if existing user is found', function(done) {
      this.UserGetter.getUserByAnyEmail.callsArgWith(1, null, this.fakeUser)
      this.UserGetter.ensureUniqueEmailAddress(this.newEmail, err => {
        should.exist(err)
        expect(err).to.be.an.instanceof(Errors.EmailExistsError)
        done()
      })
    })

    it('should return null if no user is found', function(done) {
      this.UserGetter.getUserByAnyEmail.callsArgWith(1)
      this.UserGetter.ensureUniqueEmailAddress(this.newEmail, err => {
        should.not.exist(err)
        done()
      })
    })
  })
})
