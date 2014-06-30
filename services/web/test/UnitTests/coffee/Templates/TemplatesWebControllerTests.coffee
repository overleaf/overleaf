should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Templates/TemplatesWebController"
expect = require("chai").expect

describe "TemplatesWebController", ->

	beforeEach ->

		@settings = 
			apis:
				templates_api:
					url:"templates.sharelatex.env"
		@TemplatesWebController = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": 
				log:->
				err:->
		@stubbedApiData = 
			template:{_id:"12312321", name:"bob"}
			tag: {name:"tag name"}

		@TemplatesWebController._getDataFromTemplatesApi = sinon.stub().callsArgWith(1, null, @stubbedApiData)

		@user_id = "12332lk3jlkj"
		@tag_name = "tag-name-here"
		@template_name = "template-name-here"
		@template_id = "template_id_here"
		@req = 
			params: 
				user_id: @user_id
		@res = {}

	describe "renderTemplatesIndexPage", ->

		it "should get the data from the templates api", (done)->
			@res.render = (viewName, data)=>
				@TemplatesWebController._getDataFromTemplatesApi.calledWith("/user/#{@user_id}").should.equal true
				data.should.equal @stubbedApiData
				done()
			@TemplatesWebController.renderTemplatesIndexPage @req, @res


	describe "renerTemplateInTag", ->

		it "should get the data from the templates api", (done)->
			@res.render = (viewName, data)=>
				@TemplatesWebController._getDataFromTemplatesApi.calledWith("/user/#{@user_id}/tag/#{@tag_name}/template/#{@template_name}").should.equal true
				data.should.equal @stubbedApiData
				done()

			@req.params =
				user_id:@user_id
				template_name:@template_name
				tag_name:@tag_name

			@TemplatesWebController.renerTemplateInTag @req, @res


	describe "tagOrCanonicalPage", ->

		beforeEach ->
			@TemplatesWebController._renderCanonicalPage = sinon.stub()
			@TemplatesWebController._renderAllTemplatesPage = sinon.stub()
			@TemplatesWebController._renderTagPage = sinon.stub()

		it "should call _renderCanonicalPage if there is a template id", ()->

			@req.params =
				template_id:@template_id

			@TemplatesWebController.tagOrCanonicalPage @req, @res

			@TemplatesWebController._renderCanonicalPage.called.should.equal true
			@TemplatesWebController._renderAllTemplatesPage.called.should.equal false
			@TemplatesWebController._renderTagPage.called.should.equal false

		it "should call _renderAllTemplatesPage the tag name is all", ()->

			@req.params =
				tag_name:"all"

			@TemplatesWebController.tagOrCanonicalPage @req, @res

			@TemplatesWebController._renderCanonicalPage.called.should.equal false
			@TemplatesWebController._renderAllTemplatesPage.called.should.equal true
			@TemplatesWebController._renderTagPage.called.should.equal false


		it "should call _renderTagPage the tag name is set", ()->

			@req.params =
				tag_name:"some-tag"

			@TemplatesWebController.tagOrCanonicalPage @req, @res

			@TemplatesWebController._renderCanonicalPage.called.should.equal false
			@TemplatesWebController._renderAllTemplatesPage.called.should.equal false
			@TemplatesWebController._renderTagPage.called.should.equal true

	describe "_renderCanonicalPage", ->

		it "should get the data from the templates api", (done)->
			@res.render = (viewName, data)=>
				@TemplatesWebController._getDataFromTemplatesApi.calledWith("/user/#{@user_id}/template/#{@template_id}").should.equal true
				data.tag = null
				data.should.equal @stubbedApiData
				done()

			@req.params =
				user_id:@user_id
				template_id:@template_id

			@TemplatesWebController._renderCanonicalPage @req, @res


	describe "_renderAllTemplatesPage", ->

		it "should get the data from the templates api", (done)->
			@res.render = (viewName, data)=>
				@TemplatesWebController._getDataFromTemplatesApi.calledWith("/user/#{@user_id}/all").should.equal true
				data.should.equal @stubbedApiData
				done()

			@req.params =
				user_id:@user_id

			@TemplatesWebController._renderAllTemplatesPage @req, @res


	describe "_renderTagPage", ->

		it "should get the data from the templates api", (done)->
			@res.render = (viewName, data)=>
				@TemplatesWebController._getDataFromTemplatesApi.calledWith("/user/#{@user_id}/tag/#{@tag_name}").should.equal true
				data.should.equal @stubbedApiData
				done()

			@req.params =
				user_id:@user_id
				tag_name:@tag_name

			@TemplatesWebController._renderTagPage @req, @res




