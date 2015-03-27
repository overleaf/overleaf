sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../app/js/RedisManager"
SandboxedModule = require('sandboxed-module')

describe "RedisManager.setDocument and getDocument", ->
	beforeEach ->
		@zip_opts =
			writesEnabled: true
			minSize: 1000
		@doc_id = "document-id"
		@version = 123
		@RedisManager = SandboxedModule.require modulePath, requires:
			"settings-sharelatex" :
				redis:
					web:
						host: 'none'
						port: 'none'
					zip: @zip_opts
			"redis-sharelatex" : createClient: () =>
				@rclient ?=
					auth:-> # only assign one rclient
					multi: () => @rclient
					set: (key, value) => @rclient.store[key] = value
					get: (key) => @rclient.results.push @rclient.store[key]
					incr: (key) => @rclient.store[key]++
					exec: (callback) =>
						callback.apply(null, [null, @rclient.results])
						@rclient.results = []
					store: {}
					results: []
			"logger-sharelatex": {}

		@RedisManager.setDocument(@doc_id, @docLines, @version, @callback)

	describe "for a small document (uncompressed)", ->
		before ->
			@docLines = ["hello", "world"]
			@callback = sinon.stub()

		it "should set the document", ->
			@rclient.store['doclines:document-id']
				.should.equal JSON.stringify(@docLines)

		it "should return the callback", ->
			@callback.called.should.equal true

		it "should get the document back again", (done) ->
			@RedisManager.getDoc @doc_id, (err, lines, version) =>
				@docLines.should.eql lines
				done()

	describe "for a large document (with compression enabled)", ->
		before ->
			@zip_opts =
				writesEnabled: true
				minSize: 1000
			@docLines = []
			while @docLines.join('').length <= @zip_opts.minSize
				@docLines.push "this is a long line in a long document"
			@callback = sinon.stub()
		
		it "should set the document as a gzipped blob", ->
			@rclient.store['doclines:document-id']
				.should.not.equal JSON.stringify(@docLines)

		it "should return the callback", ->
			@callback.called.should.equal true

		it "should get the uncompressed document back again", (done) ->
			@RedisManager.getDoc @doc_id, (err, lines, version) =>
				@docLines.should.eql lines
				done()

	describe "for a large document (with compression disabled)", ->
		before ->
			@zip_opts =
				writesEnabled: false
				minSize: 1000
			@docLines = []
			while @docLines.join('').length <= @zip_opts.minSize
				@docLines.push "this is a long line in a long document"
			@callback = sinon.stub()
		
		it "should set the document", ->
			@rclient.store['doclines:document-id']
				.should.equal JSON.stringify(@docLines)

		it "should return the callback", ->
			@callback.called.should.equal true

		it "should get the document back again", (done) ->
			@RedisManager.getDoc @doc_id, (err, lines, version) =>
				@docLines.should.eql lines
				done()




