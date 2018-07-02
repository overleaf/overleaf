SandboxedModule = require('sandboxed-module')
assert = require('assert')
chai = require('chai')
expect = chai.expect
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Exports/ExportsController.js'


describe 'ExportsController', ->
	project_id = "123njdskj9jlk"
	user_id = "123nd3ijdks"
	brand_variation_id = 22

	beforeEach ->
		@handler =
			getUserNotifications: sinon.stub().callsArgWith(1)
		@req =
			params:
				project_id: project_id
				brand_variation_id: brand_variation_id
			session:
				user:
					_id:user_id
			i18n:
				translate:->
		@AuthenticationController =
			getLoggedInUserId: sinon.stub().returns(@req.session.user._id)
		@controller = SandboxedModule.require modulePath, requires:
			"./ExportsHandler":@handler
			'logger-sharelatex':
				log:->
				err:->
			'../Authentication/AuthenticationController': @AuthenticationController

	it 'should ask the handler to perform the export', (done) ->
		@handler.exportProject = sinon.stub().yields(null, {iAmAnExport: true, v1_id: 897})
		@controller.exportProject @req, send:(body) =>
			expect(body).to.deep.equal {export_v1_id: 897}
			done()

	it 'should ask the handler to return the status of an export', (done) ->
		@handler.fetchExport = sinon.stub().yields(
			null,
			"{\"id\":897, \"status_summary\":\"completed\"}")

		@req.params = {project_id: project_id, export_id: 897}
		@controller.exportStatus @req, send:(body) =>
			expect(body).to.deep.equal {export_json: {
				status_summary: 'completed', status_detail: undefined
			}}
			done()
