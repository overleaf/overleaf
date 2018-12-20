_ = require 'underscore'
{expect} = require 'chai'
{ObjectId} = require 'mongojs'
request = require './helpers/request'

MockProjectHistoryApi = require './helpers/MockProjectHistoryApi'
User = require './helpers/User'

describe 'Labels', ->
	beforeEach (done) ->
		@owner = new User()
		@owner.login (error) =>
			throw error if error?
			@owner.createProject 'example-project', {template: 'example'}, (error, @project_id) =>
				throw error if error?
				done()

	afterEach ->
		MockProjectHistoryApi.reset()

	it 'getting labels', (done) ->
		label_id = new ObjectId().toString()
		comment = 'a label comment'
		version = 3
		MockProjectHistoryApi.addLabel @project_id, {id: label_id, comment, version}

		@owner.request {
			method: 'GET'
			url: "/project/#{@project_id}/labels"
			json: true
		}, (error, response, body) =>
			throw error if error?
			expect(response.statusCode).to.equal 200
			expect(body).to.deep.equal [{ id: label_id, comment, version }]
			done()

	it 'creating a label', (done) ->
		comment = 'a label comment'
		version = 3

		@owner.request {
			method: 'POST'
			url: "/project/#{@project_id}/labels"
			json: {comment, version}
		}, (error, response, body) =>
			throw error if error?
			expect(response.statusCode).to.equal 200
			{label_id} = body
			expect(
				MockProjectHistoryApi.getLabels(@project_id)
			).to.deep.equal [{id: label_id, comment, version} ]
			done()

	it 'deleting a label', (done) ->
		label_id = new ObjectId().toString()
		comment = 'a label comment'
		version = 3
		MockProjectHistoryApi.addLabel @project_id, {id: label_id, comment, version}

		@owner.request {
			method: 'DELETE'
			url: "/project/#{@project_id}/labels/#{label_id}"
			json: true
		}, (error, response, body) =>
			throw error if error?
			expect(response.statusCode).to.equal 204
			expect(MockProjectHistoryApi.getLabels(@project_id)).to.deep.equal []
			done()
