chai = require('chai')
chai.should()
expect = chai.expect
sinon = require("sinon")
modulePath = "../../../../app/js/Features/Labels/LabelsHandler"
SandboxedModule = require('sandboxed-module')


describe 'LabelsHandler', ->
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
		@LabelsHandler = SandboxedModule.require modulePath, requires:
			'../Project/ProjectEntityHandler': @ProjectEntityHandler
			'../DocumentUpdater/DocumentUpdaterHandler': @DocumentUpdaterHandler

	describe 'extractLabelsFromDoc', ->
		beforeEach ->
			@lines = [
				'one',
				'two',
				'three \\label{aaa}',
				'four five',
				'\\label{bbb}',
				'six seven'
			]

		it 'should extract all the labels', ->
			docLabels = @LabelsHandler.extractLabelsFromDoc @lines
			expect(docLabels).to.deep.equal ['aaa', 'bbb']

	describe 'extractLabelsFromProjectDocs', ->
		beforeEach ->
			@docs = {
				'doc_one': {
					_id: 'id_one',
					lines: ['one', '\\label{aaa} two', 'three']
				},
				'doc_two': {
					_id: 'id_two',
					lines: ['four']
				},
				'doc_three': {
					_id: 'id_three',
					lines: ['\\label{bbb}', 'five six', 'seven eight \\label{ccc} nine']
				}
			}

		it 'should extract all the labels', ->
			projectLabels = @LabelsHandler.extractLabelsFromProjectDocs @docs
			expect(projectLabels).to.deep.equal {
				'id_one': ['aaa'],
				'id_two': [],
				'id_three': ['bbb', 'ccc']
			}

	describe 'getLabelsForDoc', ->
		beforeEach ->
			@fakeLines = ['one', '\\label{aaa}', 'two']
			@fakeLabels = ['aaa']
			@DocumentUpdaterHandler.flushDocToMongo = sinon.stub().callsArgWith(2, null)
			@ProjectEntityHandler.getDoc = sinon.stub().callsArgWith(2, null, @fakeLines)
			@LabelsHandler.extractLabelsFromDoc = sinon.stub().returns(@fakeLabels)
			@call = (callback) =>
				@LabelsHandler.getLabelsForDoc @projectId, @docId, callback

		it 'should not produce an error', (done) ->
			@call (err, docLabels) =>
				expect(err).to.equal null
				done()

		it 'should produce docLabels', (done) ->
			@call (err, docLabels) =>
				expect(docLabels).to.equal @fakeLabels
				done()

		it 'should call flushDocToMongo', (done) ->
			@call (err, docLabels) =>
				@DocumentUpdaterHandler.flushDocToMongo.callCount.should.equal 1
				@DocumentUpdaterHandler.flushDocToMongo.calledWith(@projectId, @docId).should.equal true
				done()

		it 'should call getDoc', (done) ->
			@call (err, docLabels) =>
				@ProjectEntityHandler.getDoc.callCount.should.equal 1
				@ProjectEntityHandler.getDoc.calledWith(@projectId, @docId).should.equal true
				done()

		it 'should call extractLabelsFromDoc', (done) ->
			@call (err, docLabels) =>
				@LabelsHandler.extractLabelsFromDoc.callCount.should.equal 1
				@LabelsHandler.extractLabelsFromDoc.calledWith(@fakeLines).should.equal true
				done()

	describe 'getAllLabelsForProject', ->
		beforeEach ->
			@fakeDocs = {
				'doc_one': {lines: ['\\label{aaa}']}
			}
			@fakeLabels = ['aaa']
			@ProjectEntityHandler.getAllDocs = sinon.stub().callsArgWith(1, null, @fakeDocs)
			@LabelsHandler.extractLabelsFromProjectDocs = sinon.stub().returns(@fakeLabels)
			@call = (callback) =>
				@LabelsHandler.getAllLabelsForProject @projectId, callback

		it 'should not produce an error', (done) ->
			@call (err, projectLabels) =>
				expect(err).to.equal null
				done()

		it 'should produce projectLabels', (done) ->
			@call (err, projectLabels) =>
				expect(projectLabels).to.equal @fakeLabels
				done()

		it 'should call getAllDocs', (done) ->
			@call (err, projectLabels) =>
				@ProjectEntityHandler.getAllDocs.callCount.should.equal 1
				@ProjectEntityHandler.getAllDocs.calledWith(@projectId).should.equal true
				done()

		it 'should call extractLabelsFromDoc', (done) ->
			@call (err, docLabels) =>
				@LabelsHandler.extractLabelsFromProjectDocs.callCount.should.equal 1
				@LabelsHandler.extractLabelsFromProjectDocs.calledWith(@fakeDocs).should.equal true
				done()
