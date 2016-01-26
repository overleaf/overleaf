SandboxedModule = require('sandboxed-module')
should = require('chai').should()
expect = require('chai').expect
sinon = require 'sinon'
assert = require("chai").assert
modulePath = "../../../../app/js/Features/ReferencesSearch/ReferencesSearchHandler"

describe 'ReferencesSearchHandler', ->

	beforeEach ->
		@projectId = '222'
		@fakeProject =
			_id: @projectId
			owner_ref: @fakeOwner =
				_id: 'some_owner'
				features:
					references: false
			rootFolder: [
				docs: [
					{name: 'one.bib', _id: 'aaa'},
					{name: 'two.txt', _id: 'bbb'},
				]
				folders: [
					{docs: [{name: 'three.bib', _id: 'ccc'}], folders: []}
				]
			]
		@docIds = ['aaa', 'ccc']
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
			'../../models/Project': {
				Project: @Project = {
					findPopulatedById: sinon.stub().callsArgWith(1, null, @fakeProject)
				}
			}
		@fakeResponseData =
			projectId: @projectId
			keys: ['k1', 'k2']

	describe 'index', ->

		beforeEach ->
			sinon.stub(@handler, '_findBibDocIds')
			sinon.stub(@handler, '_isFullIndex').callsArgWith(1, null, true)
			@request.post.callsArgWith(1, null, {statusCode: 200}, @fakeResponseData)
			@call = (callback) =>
				@handler.index @projectId, @docIds, callback

		describe 'with docIds as an array', ->

			beforeEach ->
				@docIds = ['aaa', 'ccc']

			it 'should not call _findBibDocIds', (done) ->
				@call (err, data) =>
					@handler._findBibDocIds.callCount.should.equal 0
					done()

			it 'should call Project.findPopulatedById', (done) ->
				@call (err, data) =>
					@Project.findPopulatedById.callCount.should.equal 1
					@Project.findPopulatedById.calledWith(@projectId).should.equal true
					done()

			it 'should make a request to references service', (done) ->
				@call (err, data) =>
					@request.post.callCount.should.equal 1
					arg = @request.post.firstCall.args[0]
					expect(arg.json).to.have.all.keys 'docUrls', 'fullIndex'
					expect(arg.json.docUrls.length).to.equal 2
					expect(arg.json.fullIndex).to.equal true
					done()

			it 'should not produce an error', (done) ->
				@call (err, data) =>
					expect(err).to.equal null
					done()

			it 'should return data', (done) ->
				@call (err, data) =>
					expect(data).to.not.equal null
					expect(data).to.not.equal undefined
					expect(data).to.equal @fakeResponseData
					done()

		describe 'with docIds as "ALL"', ->

			beforeEach ->
				@docIds = 'ALL'
				@handler._findBibDocIds.returns(['aaa', 'ccc'])

			it 'should call _findBibDocIds', (done) ->
				@call (err, data) =>
					@handler._findBibDocIds.callCount.should.equal 1
					@handler._findBibDocIds.calledWith(@fakeProject).should.equal true
					done()

			it 'should not produce an error', (done) ->
				@call (err, data) =>
					expect(err).to.equal null
					done()

			it 'should return data', (done) ->
				@call (err, data) =>
					expect(data).to.not.equal null
					expect(data).to.not.equal undefined
					expect(data).to.equal @fakeResponseData
					done()

		describe 'when Project.findPopulatedById produces an error', ->

			beforeEach ->
				@Project.findPopulatedById.callsArgWith(1, new Error('woops'))

			it 'should produce an error', (done) ->
				@call (err, data) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					expect(data).to.equal undefined
					done()

			it 'should not send request', (done) ->
				@call (err, data) =>
					@request.post.callCount.should.equal 0
					done()

		describe 'when _isFullIndex produces an error', ->

			beforeEach ->
				@Project.findPopulatedById.callsArgWith(1, null, @fakeProject)
				@handler._isFullIndex.callsArgWith(1, new Error('woops'))

			it 'should produce an error', (done) ->
				@call (err, data) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					expect(data).to.equal undefined
					done()

			it 'should not send request', (done) ->
				@call (err, data) =>
					@request.post.callCount.should.equal 0
					done()

		describe 'when request produces an error', ->

			beforeEach ->
				@Project.findPopulatedById.callsArgWith(1, null, @fakeProject)
				@handler._isFullIndex.callsArgWith(1, null, false)
				@request.post.callsArgWith(1, new Error('woops'))

			it 'should produce an error', (done) ->
				@call (err, data) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					expect(data).to.equal undefined
					done()

		describe 'when request responds with error status', ->

			beforeEach ->
				@Project.findPopulatedById.callsArgWith(1, null, @fakeProject)
				@handler._isFullIndex.callsArgWith(1, null, false)
				@request.post.callsArgWith(1, null, {statusCode: 500}, null)

			it 'should produce an error', (done) ->
				@call (err, data) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					expect(data).to.equal undefined
					done()

	describe '_findBibDocIds', ->

		beforeEach ->
			@fakeProject =
				rootFolder: [
					docs: [
						{name: 'one.bib', _id: 'aaa'},
						{name: 'two.txt', _id: 'bbb'},
					]
					folders: [
						{docs: [{name: 'three.bib', _id: 'ccc'}], folders: []}
					]
				]
			@expectedIds = ['aaa', 'ccc']

		it 'should select the correct docIds', ->
			result = @handler._findBibDocIds(@fakeProject)
			expect(result).to.deep.equal @expectedIds

	describe '_isFullIndex', ->

		beforeEach ->
			@fakeProject =
				owner_ref:
					features:
						references: false
			@call = (callback) =>
				@handler._isFullIndex @fakeProject, callback

		describe 'with references feature on', ->

			beforeEach ->
				@fakeProject.owner_ref.features.references = true

			it 'should return true', ->
				@call (err, isFullIndex) =>
					expect(err).to.equal null
					expect(isFullIndex).to.equal true

		describe 'with references feature off', ->

			beforeEach ->
				@fakeProject.owner_ref.features.references = false

			it 'should return false', ->
				@call (err, isFullIndex) =>
					expect(err).to.equal null
					expect(isFullIndex).to.equal false
