chai = require('chai')
chai.should()
expect = chai.expect
sinon = require("sinon")
modulePath = "../../../../app/js/Features/Metadata/MetaHandler"
SandboxedModule = require('sandboxed-module')


describe 'MetaHandler', ->
	beforeEach ->
		@projectId = 'someprojectid'
		@docId = 'somedocid'
		@ProjectEntityHandler = {
			getAllDocs: sinon.stub()
			getDoc: sinon.stub()
		}
		@DocumentUpdaterHandler = {
			flushDocToMongo: sinon.stub()
		}
		@MetaHandler = SandboxedModule.require modulePath, requires:
			'../Project/ProjectEntityHandler': @ProjectEntityHandler
			'../DocumentUpdater/DocumentUpdaterHandler': @DocumentUpdaterHandler

	describe 'extractMetaFromDoc', ->
		beforeEach ->
			@lines = [
				'\\usepackage{foo}'
				'\\usepackage{bar, baz}'
				'one'
				'two'
				'three \\label{aaa}'
				'four five'
				'\\label{bbb}'
				'six seven'
			]

		it 'should extract all the labels and packages', ->
			docMeta = @MetaHandler.extractMetaFromDoc @lines
			expect(docMeta).to.deep.equal {
				labels: ['aaa', 'bbb']
				packages: ['foo', 'bar', 'baz']
			}

	describe 'extractMetaFromProjectDocs', ->
		beforeEach ->
			@docs =
				'doc_one':
					_id: 'id_one'
					lines: ['one', '\\label{aaa} two', 'three']
				'doc_two':
					_id: 'id_two'
					lines: ['four']
				'doc_three':
					_id: 'id_three'
					lines: [
						'\\label{bbb}'
						'five six'
						'seven eight \\label{ccc} nine'
					]
				'doc_four':
					_id: 'id_four'
					lines: [
						'\\usepackage[foo=bar,baz=bat]{ddd}'
						'\\usepackage[draft]{something}'
					]
				'doc_five':
					_id: 'id_five'
					lines: [
						'\\usepackage{this,that}'
						'\\usepackage[options=foo]{hello}'
						'some text'
						'\\section{this}\\label{sec:intro}'
						'In Section \\ref{sec:intro} we saw'
						'nothing'
					]

		it 'should extract all metadata', ->
			projectMeta = @MetaHandler.extractMetaFromProjectDocs @docs
			expect(projectMeta).to.deep.equal {
				'id_one': {labels: ['aaa'], packages: []}
				'id_two': {labels: [], packages: []}
				'id_three': {labels: ['bbb', 'ccc'], packages: []}
				'id_four': {labels: [], packages: ['ddd', 'something']}
				'id_five': {labels: ['sec:intro'], packages: ['this', 'that', 'hello']}
			}

	describe 'getMetaForDoc', ->
		beforeEach ->
			@fakeLines = ['\\usepackage{abc}', 'one', '\\label{aaa}', 'two']
			@fakeMeta = {labels: ['aaa'], packages: ['abc']}
			@DocumentUpdaterHandler.flushDocToMongo = sinon.stub().callsArgWith 2, null
			@ProjectEntityHandler.getDoc = sinon.stub().callsArgWith 2, null, @fakeLines
			@MetaHandler.extractMetaFromDoc = sinon.stub().returns @fakeMeta
			@call = (callback) =>
				@MetaHandler.getMetaForDoc @projectId, @docId, callback

		it 'should not produce an error', (done) ->
			@call (err, docMeta) =>
				expect(err).to.equal null
				done()

		it 'should produce docMeta', (done) ->
			@call (err, docMeta) =>
				expect(docMeta).to.equal @fakeMeta
				done()

		it 'should call flushDocToMongo', (done) ->
			@call (err, docMeta) =>
				@DocumentUpdaterHandler.flushDocToMongo.callCount.should.equal 1
				@DocumentUpdaterHandler.flushDocToMongo.calledWith(@projectId, @docId).should.equal true
				done()

		it 'should call getDoc', (done) ->
			@call (err, docMeta) =>
				@ProjectEntityHandler.getDoc.callCount.should.equal 1
				@ProjectEntityHandler.getDoc.calledWith(@projectId, @docId).should.equal true
				done()

		it 'should call extractMetaFromDoc', (done) ->
			@call (err, docMeta) =>
				@MetaHandler.extractMetaFromDoc.callCount.should.equal 1
				@MetaHandler.extractMetaFromDoc.calledWith(@fakeLines).should.equal true
				done()

	describe 'getAllMetaForProject', ->
		beforeEach ->
			@fakeDocs =
				'doc_one':
					lines: [
						'\\usepackage[some-options,more=foo]{pkg}'
						'\\label{aaa}'
					]

			@fakeMeta = {labels: ['aaa'], packages: ['pkg']}
			@DocumentUpdaterHandler.flushProjectToMongo = sinon.stub().callsArgWith 1, null
			@ProjectEntityHandler.getAllDocs = sinon.stub().callsArgWith 1, null, @fakeDocs
			@MetaHandler.extractMetaFromProjectDocs = sinon.stub().returns @fakeMeta
			@call = (callback) =>
				@MetaHandler.getAllMetaForProject @projectId, callback

		it 'should not produce an error', (done) ->
			@call (err, projectMeta) =>
				expect(err).to.equal null
				done()

		it 'should produce projectMeta', (done) ->
			@call (err, projectMeta) =>
				expect(projectMeta).to.equal @fakeMeta
				done()

		it 'should call getAllDocs', (done) ->
			@call (err, projectMeta) =>
				@ProjectEntityHandler.getAllDocs.callCount.should.equal 1
				@ProjectEntityHandler.getAllDocs.calledWith(@projectId).should.equal true
				done()

		it 'should call extractMetaFromDoc', (done) ->
			@call (err, docMeta) =>
				@MetaHandler.extractMetaFromProjectDocs.callCount.should.equal 1
				@MetaHandler.extractMetaFromProjectDocs.calledWith(@fakeDocs).should.equal true
				done()
