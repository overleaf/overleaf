SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Tags/TagsController.js'


describe 'Tags controller', ->
	user_id = "123nd3ijdks"
	project_id = "123njdskj9jlk"
	tag = "some_class101"

	beforeEach ->
		@handler = 
			addTag: sinon.stub().callsArgWith(3)
			removeProjectFromTag: sinon.stub().callsArgWith(3)
			deleteTag: sinon.stub().callsArg(2)
			renameTag: sinon.stub().callsArg(3)
		@controller = SandboxedModule.require modulePath, requires:
			"./TagsHandler":@handler
			'logger-sharelatex':
				log:->
				err:->
		@req =
			params:
				project_id:project_id
			session:
				user:
					_id:user_id
		
		@res = {}
		@res.status = sinon.stub().returns @res
		@res.end = sinon.stub()
	
	describe "processTagsUpdate", ->
		it 'Should post the request to the tags api with the user id in the url', (done)->
			@req.body = {tag:tag}
			@controller.processTagsUpdate @req, send:=>
				@handler.addTag.calledWith(user_id, project_id, tag).should.equal true
				done()

	describe "getAllTags", ->
		it 'should ask the handler for all tags', (done)->
			allTags = [{name:"tag", projects:["123423","423423"]}]
			@handler.getAllTags = sinon.stub().callsArgWith(1, null, allTags)
			@controller.getAllTags @req, send:(body)=>
				body.should.equal allTags
				@handler.getAllTags.calledWith(user_id).should.equal true
				done()
	
	describe "deleteTag", ->
		beforeEach ->
			@req.params.tag_id = @tag_id = "tag-id-123"
			@req.session.user._id = @user_id = "user-id-123"
			@controller.deleteTag @req, @res
			
		it "should delete the tag in the backend", ->
			@handler.deleteTag
				.calledWith(@user_id, @tag_id)
				.should.equal true
		
		it "should return 204 status code", ->
			@res.status.calledWith(204).should.equal true
			@res.end.called.should.equal true

	describe "renameTag", ->
		beforeEach ->
			@req.params.tag_id = @tag_id = "tag-id-123"
			@req.session.user._id = @user_id = "user-id-123"

		describe "with a name", ->
			beforeEach ->
				@req.body = name: @name = "new-name"
				@controller.renameTag @req, @res
				
			it "should delete the tag in the backend", ->
				@handler.renameTag
					.calledWith(@user_id, @tag_id, @name)
					.should.equal true
			
			it "should return 204 status code", ->
				@res.status.calledWith(204).should.equal true
				@res.end.called.should.equal true
		
		describe "without a name", ->
			beforeEach ->
				@controller.renameTag @req, @res
				
			it "should not call the backend", ->
				@handler.renameTag.called.should.equal false
			
			it "should return 400 (bad request) status code", ->
				@res.status.calledWith(400).should.equal true
				@res.end.called.should.equal true
	
	describe "removeProjectFromTag", ->
		beforeEach ->
			@req.params.tag_id = @tag_id = "tag-id-123"
			@req.params.project_id = @project_id = "project-id-123"
			@req.session.user._id = @user_id = "user-id-123"
			@controller.removeProjectFromTag @req, @res
			
		it "should remove the tag from the project in the backend", ->
			@handler.removeProjectFromTag
				.calledWith(@user_id, @tag_id, @project_id)
				.should.equal true
		
		it "should return 204 status code", ->
			@res.status.calledWith(204).should.equal true
			@res.end.called.should.equal true
	