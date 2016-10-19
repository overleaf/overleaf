SandboxedModule = require('sandboxed-module')
should = require('chai').should()
expect = require('chai').expect
sinon = require 'sinon'
assert = require("chai").assert
modulePath = "../../../../app/js/Features/References/ReferencesHandler"

describe 'ReferencesHandler', ->

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
					{
						docs: [{name: 'three.bib', _id: 'ccc'}],
						fileRefs: [{name: 'four.bib', _id: 'ghg'}],
						folders: []
					}
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
					references: {url: 'http://some.url/references'}
					docstore: {url: 'http://some.url/docstore'}
					filestore: {url: 'http://some.url/filestore'}
			}
			'request': @request = {
				get: sinon.stub()
				post: sinon.stub()
			}
			'../Project/ProjectGetter': @ProjectGetter = {
				getProject: sinon.stub().callsArgWith(2, null, @fakeProject)
			}
			'../User/UserGetter': @UserGetter = {
				getUser: sinon.stub()
			}
			'../DocumentUpdater/DocumentUpdaterHandler': @DocumentUpdaterHandler = {
				flushDocToMongo: sinon.stub().callsArgWith(2, null)
			}
		@fakeResponseData =
			projectId: @projectId
			keys: ['k1', 'k2']

	describe 'index', ->

		beforeEach ->
			sinon.stub(@handler, '_findBibDocIds')
			sinon.stub(@handler, '_findBibFileIds')
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

			it 'should call ProjectGetter.getProject', (done) ->
				@call (err, data) =>
					@ProjectGetter.getProject.callCount.should.equal 1
					@ProjectGetter.getProject.calledWith(@projectId).should.equal true
					done()

			it 'should not call _findBibDocIds', (done) ->
				@call (err, data) =>
					@handler._findBibDocIds.callCount.should.equal 0
					done()

			it 'should call DocumentUpdaterHandler.flushDocToMongo', (done) ->
				@call (err, data) =>
					@DocumentUpdaterHandler.flushDocToMongo.callCount.should.equal 2
					@docIds.forEach (docId) =>
						@DocumentUpdaterHandler.flushDocToMongo.calledWith(@projectId, docId).should.equal true
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

		describe 'when ProjectGetter.getProject produces an error', ->

			beforeEach ->
				@ProjectGetter.getProject.callsArgWith(2, new Error('woops'))

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
				@ProjectGetter.getProject.callsArgWith(2, null, @fakeProject)
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

		describe 'when flushDocToMongo produces an error', ->

			beforeEach ->
				@ProjectGetter.getProject.callsArgWith(2, null, @fakeProject)
				@handler._isFullIndex.callsArgWith(1, false)
				@DocumentUpdaterHandler.flushDocToMongo.callsArgWith(2, new Error('woops'))

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
				@ProjectGetter.getProject.callsArgWith(2, null, @fakeProject)
				@handler._isFullIndex.callsArgWith(1, null, false)
				@DocumentUpdaterHandler.flushDocToMongo.callsArgWith(2, null)
				@request.post.callsArgWith(1, new Error('woops'))

			it 'should produce an error', (done) ->
				@call (err, data) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					expect(data).to.equal undefined
					done()

		describe 'when request responds with error status', ->

			beforeEach ->
				@ProjectGetter.getProject.callsArgWith(2, null, @fakeProject)
				@handler._isFullIndex.callsArgWith(1, null, false)
				@request.post.callsArgWith(1, null, {statusCode: 500}, null)

			it 'should produce an error', (done) ->
				@call (err, data) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					expect(data).to.equal undefined
					done()

	describe 'indexAll', ->

		beforeEach ->
			sinon.stub(@handler, '_findBibDocIds').returns(['aaa', 'ccc'])
			sinon.stub(@handler, '_findBibFileIds').returns(['fff', 'ggg'])
			sinon.stub(@handler, '_isFullIndex').callsArgWith(1, null, true)
			@request.post.callsArgWith(1, null, {statusCode: 200}, @fakeResponseData)
			@call = (callback) =>
				@handler.indexAll @projectId, callback

		it 'should call _findBibDocIds', (done) ->
			@call (err, data) =>
				@handler._findBibDocIds.callCount.should.equal 1
				@handler._findBibDocIds.calledWith(@fakeProject).should.equal true
				done()

		it 'should call _findBibFileIds', (done) ->
			@call (err, data) =>
				@handler._findBibDocIds.callCount.should.equal 1
				@handler._findBibDocIds.calledWith(@fakeProject).should.equal true
				done()

		it 'should call DocumentUpdaterHandler.flushDocToMongo', (done) ->
			@call (err, data) =>
				@DocumentUpdaterHandler.flushDocToMongo.callCount.should.equal 2
				done()

		it 'should make a request to references service', (done) ->
			@call (err, data) =>
				@request.post.callCount.should.equal 1
				arg = @request.post.firstCall.args[0]
				expect(arg.json).to.have.all.keys 'docUrls', 'fullIndex'
				expect(arg.json.docUrls.length).to.equal 4
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

		describe 'when ProjectGetter.getProject produces an error', ->

			beforeEach ->
				@ProjectGetter.getProject.callsArgWith(2, new Error('woops'))

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
				@ProjectGetter.getProject.callsArgWith(2, null, @fakeProject)
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

		describe 'when flushDocToMongo produces an error', ->

			beforeEach ->
				@ProjectGetter.getProject.callsArgWith(2, null, @fakeProject)
				@handler._isFullIndex.callsArgWith(1, false)
				@DocumentUpdaterHandler.flushDocToMongo.callsArgWith(2, new Error('woops'))

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

		it 'should not error with a non array of folders from dirty data', ->
			@fakeProject.rootFolder[0].folders[0].folders = {}
			result = @handler._findBibDocIds(@fakeProject)
			expect(result).to.deep.equal @expectedIds

	describe '_findBibFileIds', ->

		beforeEach ->
			@fakeProject =
				rootFolder: [
					docs: [
						{name: 'one.bib', _id: 'aaa'},
						{name: 'two.txt', _id: 'bbb'},
					]
					fileRefs: [
						{name: 'other.bib', _id: 'ddd'}
					],
					folders: [
						{
							docs: [{name: 'three.bib', _id: 'ccc'}],
							fileRefs: [{name: 'four.bib', _id: 'ghg'}],
							folders: []
						}
					]
				]
			@expectedIds = ['ddd', 'ghg']

		it 'should select the correct docIds', ->
			result = @handler._findBibFileIds(@fakeProject)
			expect(result).to.deep.equal @expectedIds

	describe '_isFullIndex', ->

		beforeEach ->
			@fakeProject =
				owner_ref: @owner_ref = "owner-ref-123"
			@owner =
				features:
					references: false
			@UserGetter.getUser = sinon.stub()
			@UserGetter.getUser.withArgs(@owner_ref, {features: true}).yields(null, @owner)
			@call = (callback) =>
				@handler._isFullIndex @fakeProject, callback

		describe 'with references feature on', ->

			beforeEach ->
				@owner.features.references = true

			it 'should return true', ->
				@call (err, isFullIndex) =>
					expect(err).to.equal null
					expect(isFullIndex).to.equal true

		describe 'with references feature off', ->

			beforeEach ->
				@owner.features.references = false

			it 'should return false', ->
				@call (err, isFullIndex) =>
					expect(err).to.equal null
					expect(isFullIndex).to.equal false
