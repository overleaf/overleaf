SandboxedModule = require('sandboxed-module')
require('chai').should()
expect = require('chai').expect
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Publishers/PublishersGetter.js'

describe 'PublishersGetter', ->
	beforeEach ->
		@publisher =
			_id: 'mock-publsiher-id'
			slug: 'ieee'
			fetchV1Data: sinon.stub()

		@PublishersGetter = SandboxedModule.require modulePath, requires:
			'../User/UserGetter': @UserGetter
			"../UserMembership/UserMembershipHandler": @UserMembershipHandler = {
				getEntitiesByUser: sinon.stub().callsArgWith(2, null, [@publisher])
			}
			"../UserMembership/UserMembershipEntityConfigs": @UserMembershipEntityConfigs = {
					publisher:
						modelName: 'Publisher'
						canCreate: true
						fields:
							primaryKey: 'slug'
				}
			'logger-sharelatex':
				log:-> console.log(arguments)
				err:->

		@userId = '12345abcde'

	describe "getManagedPublishers", ->
			it 'fetches v1 data before returning publisher list', (done) ->
				@PublishersGetter.getManagedPublishers @userId, (error, publishers) ->
					publishers.length.should.equal 1
					done()
