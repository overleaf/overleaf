SandboxedModule = require('sandboxed-module')
should = require('chai').should()
expect = require('chai').expect
sinon = require 'sinon'
assert = require("chai").assert
modulePath = "../../../../app/js/Features/ReferencesSearch/ReferencesSearchHandler"

describe 'ReferencesSearchHandler', ->

	beforeEach ->
		@project_id = '222'
		@file_id = '111111'
		@handler = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': {
				log: ->
				err: ->
			}
			'settings-sharelatex': @settings = {
				apis:
					references: {url: 'http://some.url'}
					web: {url: 'http://some.url'}
			}
			'request': @request = {
				get: sinon.stub()
				post: sinon.stub()
			}
			'../../models/Project': @Project = {
				Project: {
					findById: sinon.stub().callsArgWith(2, null, {owner_ref: '111'})
				}
			}
			'../User/UserGetter': @UserGetter = {
				getUser: sinon.stub().callsArgWith(2, null, {features: {references: false}})
			}

	describe 'indexFile', ->

		describe 'full index or not', ->

			beforeEach ->
				@request.post.callsArgWith(1, null, {statusCode: 200}, {})

			describe 'when full index is not required', ->

				beforeEach ->
					@UserGetter.getUser.callsArgWith(2, null, {features: {references: false}})

				it 'should set fullIndex to true', (done) ->
					@handler.indexFile @project_id, @file_id, (err) =>
						@request.post.calledOnce.should.equal true
						options = @request.post.firstCall.args[0]
						options.json.fullIndex.should.equal false
						done()

			describe 'when full index is required', ->

				beforeEach ->
					@UserGetter.getUser.callsArgWith(2, null, {features: {references: true}})

				it 'should set fullIndex to true', (done) ->
					@handler.indexFile @project_id, @file_id, (err) =>
						@request.post.calledOnce.should.equal true
						options = @request.post.firstCall.args[0]
						options.json.fullIndex.should.equal true
						done()

		describe 'when index operation is successful', ->
			beforeEach ->
				@request.post.callsArgWith(1, null, {statusCode: 201}, {})

			it 'should not produce an error', (done) ->
				@handler.indexFile @project_id, @file_id, (err) =>
					expect(err).to.equal null
					@request.post.calledOnce.should.equal true
					options = @request.post.firstCall.args[0]
					options.json.fullIndex.should.equal false
					options.json.referencesUrl.should.not.be.undefined
					options.url.should.not.be.undefined
					done()

		describe 'when index operation fails', ->
			beforeEach ->
				@request.post.callsArgWith(1, null, {statusCode: 500}, {})

			it 'should produce an error', (done) ->
				@handler.indexFile @project_id, @file_id, (err) =>
					expect(err).to.not.equal null
					done()

	describe 'getKeys', ->

		describe 'when request is successful', ->
			beforeEach ->
				@data =
					projectId: @projectId
					keys: ['a', 'b', 'c']
				@request.get.callsArgWith(1, null, {statusCode: 200}, @data)

			it 'should not produce an error', ->
				@handler.getKeys @project_id, (err, result) =>
					expect(err).to.equal null

			it 'should produce a result object', ->
				@handler.getKeys @project_id, (err, result) =>
					expect(result).to.not.equal null
					expect(result).to.deep.equal @data

		describe 'when request fails', ->
			beforeEach ->
				@data =
					projectId: @project_Id
					keys: ['a', 'b', 'c']
				@request.get.callsArgWith(1, null, {statusCode: 500}, null)

			it 'should produce an error', ->
				@handler.getKeys @project_id, (err, result) =>
					expect(err).to.not.equal null

			it 'should not produce a result', ->
				@handler.getKeys @project_id, (err, result) =>
					expect(result).to.not.equal null
