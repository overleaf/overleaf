SandboxedModule = require('sandboxed-module')
assert = require('chai').assert
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Tags/TagsHandler.js'
_ = require('underscore')


describe 'TagsHandler', ->
	user_id = "user-id-123"
	tag_id = "tag-id-123"
	project_id = "project-id-123"
	tagsUrl = "tags.sharelatex.testing"
	tag = "tag_name"

	beforeEach ->
		@request = 
			post: sinon.stub().callsArgWith(1)
			del: sinon.stub().callsArgWith(1)
			get: sinon.stub()
		@callback = sinon.stub()
		@handler = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": apis:{tags:{url:tagsUrl}}
			"request":@request
			'logger-sharelatex':
				log:->
				err:->

	describe "removeProjectFromAllTags", ->
		it 'should tell the tags api to remove the project_id from all the users tags', (done)->
			@handler.removeProjectFromAllTags user_id, project_id, =>
				@request.del.calledWith({url:"#{tagsUrl}/user/#{user_id}/project/#{project_id}", timeout:1000}).should.equal true
				done()

	describe "_groupTagsByProject", ->
		it 'should 	group the tags by project_id', (done)->
			rawTags = [
				{name:"class101", project_ids:["1234", "51db33e31a55afd212000007"]}
				{name:"class201", project_ids:["1234", "51db33e31a55afd212000007"]}
				{name:"research group", project_ids:["12", "51da65f2e2c39a2f09000100", "odjaskdas","dasdsa"]}
				{name:"different", project_ids:["1234", "e2c39a2f09000100"]}
			]

			@handler._groupTagsByProject rawTags, (err, tags)->
				_.size(tags).should.equal 7
				done()

	describe "_requestTags", ->
		it 'should return an err and empty array on error', (done)->
			@request.get.callsArgWith(1, {something:"wrong"}, {statusCode:200}, [])
			@handler._requestTags user_id, (err, allTags)=>
				allTags.length.should.equal 0
				assert.isDefined err
				done()

		it 'should return an err and empty array on no body', (done)->
			@request.get.callsArgWith(1, {something:"wrong"}, {statusCode:200}, undefined)
			@handler._requestTags user_id, (err, allTags)=>
				allTags.length.should.equal 0
				assert.isDefined err
				done()

		it 'should return an err and empty array on non 200 response', (done)->
			@request.get.callsArgWith(1, null, {statusCode:201}, [])
			@handler._requestTags user_id, (err, allTags)=>
				allTags.length.should.equal 0
				assert.isDefined err
				done()

		it 'should return an err and empty array on no body and no response', (done)->
			@request.get.callsArgWith(1, {something:"wrong"}, undefined, undefined)
			@handler._requestTags user_id, (err, allTags)=>
				allTags.length.should.equal 0
				assert.isDefined err
				done()

	describe "getAllTags", ->
		it 'should get all tags', (done)->
			stubbedAllTags = [{name:"tag", project_ids:["123423","423423"]}]
			@request.get.callsArgWith(1, null, {statusCode:200}, stubbedAllTags)
			@handler.getAllTags user_id, (err, allTags)=>
				stubbedAllTags.should.deep.equal allTags
				getOpts =
					url: "#{tagsUrl}/user/#{user_id}/tag"
					json:true
					timeout:1000
				@request.get.calledWith(getOpts).should.equal true
				done()

		it 'should return empty arrays if there are no tags', ->
			@request.get.callsArgWith(1, null, {statusCode:200}, null)
			@handler.getAllTags user_id, (err, allTags, projectGroupedTags)=>
				allTags.length.should.equal 0
				_.size(projectGroupedTags).should.equal 0
	
	describe "createTag", ->
		beforeEach ->
			@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 204}, "")
			@handler.createTag user_id, @name = "tag_name", @callback
		
		it "should send a request to the tag backend", ->
			@request.post
				.calledWith({
					url: "#{tagsUrl}/user/#{user_id}/tag"
					json:
						name: @name
					timeout: 1000
				})
				.should.equal true
		
		it "should call the callback with no error", ->
			@callback.calledWith(null).should.equal true
	
	describe "deleteTag", ->
		describe "successfully", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, null, {statusCode: 204}, "")
				@handler.deleteTag user_id, tag_id, @callback
			
			it "should send a request to the tag backend", ->
				@request.del
					.calledWith({
						url: "#{tagsUrl}/user/#{user_id}/tag/#{tag_id}"
						timeout: 1000
					})
					.should.equal true
			
			it "should call the callback with no error", ->
				@callback.calledWith(null).should.equal true
			
		describe "with error", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, null, {statusCode: 500}, "")
				@handler.deleteTag user_id, tag_id, @callback
			
			it "should call the callback with an Error", ->
				@callback.calledWith(new Error()).should.equal true

	describe "renameTag", ->
		describe "successfully", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 204}, "")
				@handler.renameTag user_id, tag_id, @name = "new-name", @callback
			
			it "should send a request to the tag backend", ->
				@request.post
					.calledWith({
						url: "#{tagsUrl}/user/#{user_id}/tag/#{tag_id}/rename"
						json:
							name: @name
						timeout: 1000
					})
					.should.equal true
			
			it "should call the callback with no error", ->
				@callback.calledWith(null).should.equal true
			
		describe "with error", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 500}, "")
				@handler.renameTag user_id, tag_id, "name", @callback
			
			it "should call the callback with an Error", ->
				@callback.calledWith(new Error()).should.equal true
	
	describe "removeProjectFromTag", ->
		describe "successfully", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, null, {statusCode: 204}, "")
				@handler.removeProjectFromTag user_id, tag_id, project_id, @callback
			
			it "should send a request to the tag backend", ->
				@request.del
					.calledWith({
						url: "#{tagsUrl}/user/#{user_id}/tag/#{tag_id}/project/#{project_id}"
						timeout: 1000
					})
					.should.equal true
			
			it "should call the callback with no error", ->
				@callback.calledWith(null).should.equal true
			
		describe "with error", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, null, {statusCode: 500}, "")
				@handler.removeProjectFromTag user_id, tag_id, project_id, @callback
			
			it "should call the callback with an Error", ->
				@callback.calledWith(new Error()).should.equal true

	describe "addProjectToTag", ->
		describe "successfully", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 204}, "")
				@handler.addProjectToTag user_id, tag_id, project_id, @callback
			
			it "should send a request to the tag backend", ->
				@request.post
					.calledWith({
						url: "#{tagsUrl}/user/#{user_id}/tag/#{tag_id}/project/#{project_id}"
						timeout: 1000
					})
					.should.equal true
			
			it "should call the callback with no error", ->
				@callback.calledWith(null).should.equal true
			
		describe "with error", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 500}, "")
				@handler.addProjectToTag user_id, tag_id, project_id, @callback
			
			it "should call the callback with an Error", ->
				@callback.calledWith(new Error()).should.equal true