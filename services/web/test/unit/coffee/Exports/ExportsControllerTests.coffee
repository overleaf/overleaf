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
	firstName = 'first'
	lastName = 'last'
	title = "title"
	description = "description"
	author = "author"
	license = "other"
	show_source = true

	beforeEach ->
		@handler =
			getUserNotifications: sinon.stub().callsArgWith(1)
		@req =
			params:
				project_id: project_id
				brand_variation_id: brand_variation_id
			body:
				firstName: firstName
				lastName: lastName
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

	describe "without gallery fields",->
		it 'should ask the handler to perform the export', (done) ->
			@handler.exportProject = sinon.stub().yields(null, {iAmAnExport: true, v1_id: 897})
			expected =
				project_id: project_id
				user_id: user_id
				brand_variation_id: brand_variation_id
				first_name: firstName
				last_name: lastName
			@controller.exportProject @req, send:(body) =>
				expect(@handler.exportProject.args[0][0]).to.deep.equal expected
				expect(body).to.deep.equal {export_v1_id: 897}
				done()

	describe "with gallery fields",->
		beforeEach ->
			@req.body.title = title
			@req.body.description = description
			@req.body.author = author
			@req.body.license = license
			@req.body.showSource = true

		it 'should ask the handler to perform the export', (done) ->
			@handler.exportProject = sinon.stub().yields(null, {iAmAnExport: true, v1_id: 897})
			expected =
				project_id: project_id
				user_id: user_id
				brand_variation_id: brand_variation_id
				first_name: firstName
				last_name: lastName
				title: title
				description: description
				author: author
				license: license
				show_source: show_source
			@controller.exportProject @req, send:(body) =>
				expect(@handler.exportProject.args[0][0]).to.deep.equal expected
				expect(body).to.deep.equal {export_v1_id: 897}
				done()

	it 'should ask the handler to return the status of an export', (done) ->
		@handler.fetchExport = sinon.stub().yields(
			null,
			"{\"id\":897, \"status_summary\":\"completed\"}")

		@req.params = {project_id: project_id, export_id: 897}
		@controller.exportStatus @req, send:(body) =>
			expect(body).to.deep.equal {export_json: {
				status_summary: 'completed', status_detail: undefined, partner_submission_id: undefined, token: undefined
			}}
			done()
