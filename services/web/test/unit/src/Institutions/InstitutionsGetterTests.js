/* eslint-disable
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
require('chai').should()
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Institutions/InstitutionsGetter.js'
)

describe('InstitutionsGetter', function() {
  beforeEach(function() {
    this.UserGetter = { getUserFullEmails: sinon.stub() }
    this.InstitutionsGetter = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../User/UserGetter': this.UserGetter,
        '../UserMembership/UserMembershipsHandler': (this.UserMembershipsHandler = {}),
        '../UserMembership/UserMembershipEntityConfigs': (this.UserMembershipEntityConfigs = {}),
        'logger-sharelatex': {
          log() {
            return console.log(arguments)
          },
          err() {}
        }
      }
    })

    return (this.userId = '12345abcde')
  })

  describe('getConfirmedInstitutions', function() {
    it('filters unconfirmed affiliations', function(done) {
      this.userEmails = [
        {
          confirmedAt: null,
          affiliation: { institution: { id: 123, confirmed: true } }
        },
        {
          confirmedAt: new Date(),
          affiliation: { institution: { id: 456, confirmed: true } }
        },
        { confirmedAt: new Date(), affiliation: null },
        { confirmedAt: new Date(), affiliation: { institution: null } },
        {
          confirmedAt: new Date(),
          affiliation: { institution: { id: 789, confirmed: false } }
        }
      ]
      this.UserGetter.getUserFullEmails.yields(null, this.userEmails)
      return this.InstitutionsGetter.getConfirmedInstitutions(
        this.userId,
        (error, institutions) => {
          expect(error).to.not.exist
          institutions.length.should.equal(1)
          institutions[0].id.should.equal(456)
          return done()
        }
      )
    })

    it('should handle empty response', function(done) {
      this.UserGetter.getUserFullEmails.yields(null, [])
      return this.InstitutionsGetter.getConfirmedInstitutions(
        this.userId,
        (error, institutions) => {
          expect(error).to.not.exist
          institutions.length.should.equal(0)
          return done()
        }
      )
    })

    it('should handle error', function(done) {
      this.UserGetter.getUserFullEmails.yields(new Error('Nope'))
      return this.InstitutionsGetter.getConfirmedInstitutions(
        this.userId,
        (error, institutions) => {
          expect(error).to.exist
          return done()
        }
      )
    })
  })
})
