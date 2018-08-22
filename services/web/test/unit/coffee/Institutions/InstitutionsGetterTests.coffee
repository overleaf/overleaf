SandboxedModule = require('sandboxed-module')
require('chai').should()
expect = require('chai').expect
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Institutions/InstitutionsGetter.js'

describe 'InstitutionsGetter', ->
	beforeEach ->
		@UserGetter = getUserFullEmails: sinon.stub()
		@InstitutionsGetter = SandboxedModule.require modulePath, requires:
			'../User/UserGetter': @UserGetter
			'logger-sharelatex':
				log:-> console.log(arguments)
				err:->

		@userId = '12345abcde'

	describe "getConfirmedInstitutions", ->
			it 'filters unconfirmed emails', (done) ->
				@userEmails = [
					{ confirmedAt: null, affiliation: institution: { id: 123 } }
					{ confirmedAt: new Date(), affiliation: institution: { id: 456 } }
					{ confirmedAt: new Date(), affiliation: null }
					{ confirmedAt: new Date(), affiliation: institution: null }
				]
				@UserGetter.getUserFullEmails.yields(null, @userEmails)
				@InstitutionsGetter.getConfirmedInstitutions @userId, (error, institutions) ->
					expect(error).to.not.exist
					institutions.length.should.equal 1
					institutions[0].id.should.equal 456
					done()

			it 'should handle empty response', (done) ->
				@UserGetter.getUserFullEmails.yields(null, [])
				@InstitutionsGetter.getConfirmedInstitutions @userId, (error, institutions) ->
					expect(error).to.not.exist
					institutions.length.should.equal 0
					done()

			it 'should handle error', (done) ->
				@UserGetter.getUserFullEmails.yields(new Error('Nope'))
				@InstitutionsGetter.getConfirmedInstitutions @userId, (error, institutions) ->
					expect(error).to.exist
					done()
