SandboxedModule = require('sandboxed-module')
should = require('chai').should()
sinon = require 'sinon'
assert = require("chai").assert
modulePath = "../../../../app/js/Features/References/ReferencesController"
MockRequest = require "../helpers/MockRequest"
MockResponse = require "../helpers/MockResponse"

describe "ReferencesController", ->

	beforeEach ->
		@projectId = '2222'
		@controller = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': {
				log: ->
				err: ->
			},
			'settings-sharelatex': @settings = {
				apis: {web: {url: 'http://some.url'}}
			},
			'./ReferencesHandler': @ReferencesHandler = {
				index: sinon.stub()
				indexAll: sinon.stub()
			},
			'../Editor/EditorRealTimeController': @EditorRealTimeController = {
				emitToRoom: sinon.stub()
			}
		@req = new MockRequest()
		@req.params.Project_id = @projectId
		@req.body =
			docIds: @docIds = ['aaa', 'bbb']
			shouldBroadcast: false
		@res = new MockResponse()
		@res.json = sinon.stub()
		@res.send = sinon.stub()
		@res.sendStatus = sinon.stub()
		@fakeResponseData =
			projectId: @projectId,
			keys: ['one', 'two', 'three']

	describe 'indexAll', ->

		beforeEach ->
			@req.body = {shouldBroadcast: false}
			@ReferencesHandler.indexAll.callsArgWith(1, null, @fakeResponseData)
			@call = (callback) =>
				@controller.indexAll @req, @res
				callback()

		it 'should not produce an error', (done) ->
			@call () =>
				@res.sendStatus.callCount.should.equal 0
				@res.sendStatus.calledWith(500).should.equal false
				@res.sendStatus.calledWith(400).should.equal false
				done()

		it 'should return data', (done) ->
			@call () =>
				@res.json.callCount.should.equal 1
				@res.json.calledWith(@fakeResponseData).should.equal true
				done()

		it 'should call ReferencesHandler.indexAll', (done) ->
			@call () =>
				@ReferencesHandler.indexAll.callCount.should.equal 1
				@ReferencesHandler.indexAll.calledWith(@projectId).should.equal true
				done()

		describe 'when shouldBroadcast is true', ->

			beforeEach ->
				@ReferencesHandler.index.callsArgWith(2, null, @fakeResponseData)
				@req.body.shouldBroadcast = true

			it 'should call EditorRealTimeController.emitToRoom', (done) ->
				@call () =>
					@EditorRealTimeController.emitToRoom.callCount.should.equal 1
					done()

			it 'should not produce an error', (done) ->
				@call () =>
					@res.sendStatus.callCount.should.equal 0
					@res.sendStatus.calledWith(500).should.equal false
					@res.sendStatus.calledWith(400).should.equal false
					done()

			it 'should still return data', (done) ->
				@call () =>
					@res.json.callCount.should.equal 1
					@res.json.calledWith(@fakeResponseData).should.equal true
					done()

		describe 'when shouldBroadcast is false', ->

			beforeEach ->
				@ReferencesHandler.index.callsArgWith(2, null, @fakeResponseData)
				@req.body.shouldBroadcast = false

			it 'should not call EditorRealTimeController.emitToRoom', (done) ->
				@call () =>
					@EditorRealTimeController.emitToRoom.callCount.should.equal 0
					done()

			it 'should not produce an error', (done) ->
				@call () =>
					@res.sendStatus.callCount.should.equal 0
					@res.sendStatus.calledWith(500).should.equal false
					@res.sendStatus.calledWith(400).should.equal false
					done()

			it 'should still return data', (done) ->
				@call () =>
					@res.json.callCount.should.equal 1
					@res.json.calledWith(@fakeResponseData).should.equal true
					done()

	describe 'there is no dataaaaaaa', ->

			beforeEach ->
				@ReferencesHandler.indexAll.callsArgWith(1)
				@call = (callback) =>
					@controller.indexAll @req, @res
					callback()

			it 'should not call EditorRealTimeController.emitToRoom', (done) ->
				@call () =>
					@EditorRealTimeController.emitToRoom.callCount.should.equal 0
					done()

			it 'should not produce an error', (done) ->
				@call () =>
					@res.sendStatus.callCount.should.equal 0
					@res.sendStatus.calledWith(500).should.equal false
					@res.sendStatus.calledWith(400).should.equal false
					done()

			it 'should close the response', (done) ->
				@call () =>
					@res.send.called.should.equal true
					done()

	describe 'index', ->

		describe 'with docIds as an array and shouldBroadcast as false', ->

			beforeEach ->
				@ReferencesHandler.index.callsArgWith(2, null, @fakeResponseData)
				@call = (callback) =>
					@controller.index @req, @res
					callback()

			it 'should call ReferencesHandler.index', (done) ->
				@call () =>
					@ReferencesHandler.index.callCount.should.equal 1
					@ReferencesHandler.index.calledWith(@projectId, @docIds).should.equal true
					done()

			it 'should return data', (done) ->
				@call () =>
					@res.json.callCount.should.equal 1
					@res.json.calledWith(@fakeResponseData).should.equal true
					done()

			it 'should not produce an error', (done) ->
				@call () =>
					@res.sendStatus.callCount.should.equal 0
					@res.sendStatus.calledWith(500).should.equal false
					@res.sendStatus.calledWith(400).should.equal false
					done()

			it 'should not call EditorRealTimController.emitToRoom', (done) ->
				@call () =>
					@EditorRealTimeController.emitToRoom.callCount.should.equal 0
					done()

			describe 'when ReferencesHandler.index produces an error', ->

				beforeEach ->
					@ReferencesHandler.index.callsArgWith(2, new Error('woops'), null)

				it 'should produce an error response', (done) ->
					@call () =>
						@res.sendStatus.callCount.should.equal 1
						@res.sendStatus.calledWith(500).should.equal true
						done()

		describe 'when shouldBroadcast is true', ->

			beforeEach ->
				@ReferencesHandler.index.callsArgWith(2, null, @fakeResponseData)
				@req.body.shouldBroadcast = true

			it 'should call EditorRealTimeController.emitToRoom', (done) ->
				@call () =>
					@EditorRealTimeController.emitToRoom.callCount.should.equal 1
					done()

			it 'should not produce an error', (done) ->
				@call () =>
					@res.sendStatus.callCount.should.equal 0
					@res.sendStatus.calledWith(500).should.equal false
					@res.sendStatus.calledWith(400).should.equal false
					done()

			it 'should still return data', (done) ->
				@call () =>
					@res.json.callCount.should.equal 1
					@res.json.calledWith(@fakeResponseData).should.equal true
					done()

		describe 'with missing docIds', ->

			beforeEach ->
				delete @req.body.docIds

			it 'should produce an error response', (done) ->
				@call () =>
					@res.sendStatus.callCount.should.equal 1
					@res.sendStatus.calledWith(400).should.equal true
					done()

			it 'should not call ReferencesHandler.index', (done) ->
				@call () =>
					@ReferencesHandler.index.callCount.should.equal 0
					done()

		describe 'with invalid docIds', ->

			beforeEach ->
				@req.body.docIds = 42

			it 'should produce an error response', (done) ->
				@call () =>
					@res.sendStatus.callCount.should.equal 1
					@res.sendStatus.calledWith(400).should.equal true
					done()

			it 'should not call ReferencesHandler.index', (done) ->
				@call () =>
					@ReferencesHandler.index.callCount.should.equal 0
					done()
