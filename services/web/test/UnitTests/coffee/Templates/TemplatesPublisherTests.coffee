should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, '../../../../app/js/Features/Templates/TemplatesPublisher'


describe 'Templates publish', ->

	beforeEach ->
		@request = 
			post: sinon.stub().callsArgWith(1)
			del: sinon.stub().callsArgWith(1)
		@settings = 
			apis:
				templates_api:
					url: "http://templates.sharelatex.env"
		@TemplatesPublisher = SandboxedModule.require modulePath, requires:
			"request": @request
			"settings-sharelatex":@settings

		@project_id = "12312132"
		@user_id = "132jlkjdsaoij"

	describe "publish", ->

		it 'should post the project to the templates api', (done)->
			@TemplatesPublisher.publish @user_id, @project_id, =>
				uri = "#{@settings.apis.templates_api.url}/templates-api/user/#{@user_id}/project/#{@project_id}"
				console.log @request.post.args, uri
				@request.post.calledWith(uri).should.equal true
				done()


	describe "unpublish", ->

		it "should make a DELETE request to templates api", (done)->
			@TemplatesPublisher.unpublish @user_id, @project_id, =>
				uri = "#{@settings.apis.templates_api.url}/templates-api/user/#{@user_id}/project/#{@project_id}"
				@request.del.calledWith(uri).should.equal true
				done()