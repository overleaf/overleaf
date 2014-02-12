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
			deleteTag: sinon.stub().callsArgWith(3)
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


	it 'Should post the request to the tags api with the user id in the url', (done)->
		@req.body = {tag:tag}
		@controller.processTagsUpdate @req, send:=>
			@handler.addTag.calledWith(user_id, project_id, tag).should.equal true
			done()


	it 'should send a delete request when a delete has been recived with the body format standardised', (done)->
		@req.body = {deletedTag:tag}
		@controller.processTagsUpdate @req, send:=>
			@handler.deleteTag.calledWith(user_id, project_id, tag).should.equal true
			done()


	it 'should ask the handler for all tags', (done)->
		allTags = [{name:"tag", projects:["123423","423423"]}]
		@handler.getAllTags = sinon.stub().callsArgWith(1, null, allTags)
		@controller.getAllTags @req, send:(body)=>
			body.should.equal allTags
			@handler.getAllTags.calledWith(user_id).should.equal true
			done()
