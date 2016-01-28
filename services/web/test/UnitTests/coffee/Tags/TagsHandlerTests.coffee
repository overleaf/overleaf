SandboxedModule = require('sandboxed-module')
assert = require('chai').assert
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Tags/TagsHandler.js'
_ = require('underscore')


describe 'TagsHandler', ->
	user_id = "123nd3ijdks"
	tag_id = "tag-id-123"
	project_id = "123njdskj9jlk"
	tagsUrl = "tags.sharelatex.testing"
	tag = "class101"

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

	describe "addTag", ->
		it 'Should post the request to the tags api with the user id in the url', (done)->
			@handler.addTag user_id, project_id, tag, =>
				@request.post.calledWith({uri:"#{tagsUrl}/user/#{user_id}/project/#{project_id}/tag", timeout:1000, json:{name:tag}}).should.equal true
				done()
	
	describe "removeProject", ->
		it 'should send a delete request when a delete has been recived with the body format standardised', (done)->
			@handler.removeProject user_id, project_id, tag, =>
				@request.del.calledWith({uri:"#{tagsUrl}/user/#{user_id}/project/#{project_id}/tag", timeout:1000,  json:{name:tag}}).should.equal true
				done()

	describe "removeProjectFromAllTags", ->
		it 'should tell the tags api to remove the project_id from all the users tags', (done)->
			@handler.removeProjectFromAllTags user_id, project_id, =>
				@request.del.calledWith({uri:"#{tagsUrl}/user/#{user_id}/project/#{project_id}", timeout:1000}).should.equal true
				done()

	describe "groupTagsByProject", ->
		it 'should 	group the tags by project_id', (done)->
			rawTags = [
				{name:"class101", project_ids:["1234", "51db33e31a55afd212000007"]}
				{name:"class201", project_ids:["1234", "51db33e31a55afd212000007"]}
				{name:"research group", project_ids:["12", "51da65f2e2c39a2f09000100", "odjaskdas","dasdsa"]}
				{name:"different", project_ids:["1234", "e2c39a2f09000100"]}
			]

			@handler.groupTagsByProject rawTags, (err, tags)->
				_.size(tags).should.equal 7
				done()

	describe "requestTags", ->
		it 'should return an err and empty array on error', (done)->
			@request.get.callsArgWith(1, {something:"wrong"}, {statusCode:200}, [])
			@handler.requestTags user_id, (err, allTags)=>
				allTags.length.should.equal 0
				assert.isDefined err
				done()

		it 'should return an err and empty array on no body', (done)->
			@request.get.callsArgWith(1, {something:"wrong"}, {statusCode:200}, undefined)
			@handler.requestTags user_id, (err, allTags)=>
				allTags.length.should.equal 0
				assert.isDefined err
				done()

		it 'should return an err and empty array on non 200 response', (done)->
			@request.get.callsArgWith(1, null, {statusCode:201}, [])
			@handler.requestTags user_id, (err, allTags)=>
				allTags.length.should.equal 0
				assert.isDefined err
				done()

		it 'should return an err and empty array on no body and no response', (done)->
			@request.get.callsArgWith(1, {something:"wrong"}, undefined, undefined)
			@handler.requestTags user_id, (err, allTags)=>
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
					uri: "#{tagsUrl}/user/#{user_id}/tag"
					json:true
					timeout:2000
				@request.get.calledWith(getOpts).should.equal true
				done()

		it 'should return empty arrays if there are no tags', ->
			@request.get.callsArgWith(1, null, {statusCode:200}, null)
			@handler.getAllTags user_id, (err, allTags, projectGroupedTags)=>
				allTags.length.should.equal 0
				_.size(projectGroupedTags).should.equal 0
	
	describe "deleteTag", ->
		describe "successfully", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, null, {statusCode: 204}, "")
				@handler.deleteTag user_id, tag_id, @callback
			
			it "should send a request to the tag backend", ->
				@request.del
					.calledWith("#{tagsUrl}/user/#{user_id}/tag/#{tag_id}")
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
