sinon = require('sinon')
should = require('chai').should()
SandboxedModule = require('sandboxed-module')

modulePath = '../../../../app/js/Features/Project/V1ProjectGetter.js'

describe 'V1ProjectGetter', ->
	beforeEach ->
		@path =
			resolve: sinon.stub().returns('path/to/integration/module')
			join: sinon.stub().returns('path/to/file/in/integration/module')
		@IntegrationProjectListGetter =
			findAllUsersProjects: sinon.stub()
		@userId = 123
		@callback = sinon.stub()

	describe 'without overleaf-integration-web-module', ->
		beforeEach ->
			@fs =
				stat: sinon.stub().yields({code: 'mock-ENOENT-error'})
			@V1ProjectGetter = SandboxedModule.require modulePath, requires:
				# Mock not finding integration module
				'fs': @fs
				'path': @path
				'logger-sharelatex': log: ->
				'path/to/file/in/integration/module': @IntegrationProjectListGetter
			# Call method
			@V1ProjectGetter.findAllUsersProjects @userId, @callback

		it 'should call the callback with no arguments', ->
			@callback.calledWith().should.equal true

	describe 'with overleaf-integration-web-module', ->
		beforeEach ->
			@fs =
				stat: sinon.stub().yields(null, isDirectory: sinon.stub().returns(true))
			@V1ProjectGetter = SandboxedModule.require modulePath, requires:
				# Mock finding integration module
				'fs': @fs
				'path': @path
				'logger-sharelatex': log: ->
				'path/to/file/in/integration/module': @IntegrationProjectListGetter
			# Mock integration module response
			@IntegrationProjectListGetter.findAllUsersProjects.yields(null, @response = {
				projects: [{ id: '123mockV1Id', title: 'mock title' }]
				tags: [{ name: 'mock tag', project_ids: ['123mockV1Id'] }]
			})
			# Call method
			@V1ProjectGetter.findAllUsersProjects @userId, @callback

		it 'should call the callback with all the projects and tags', ->
			@callback.calledWith(null, @response).should.equal true
