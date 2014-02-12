define [
	"libs/chai"
	"history/VersionListView"
	"history/VersionList"
	"history/Version"
	"libs/sinon"
], (chai, VersionListView, VersionList, Version) ->
	should = chai.should()

	describe "VersionListView", ->
		beforeEach ->
			collection = @collection = new VersionList()
			versionCounter = 1
			@collection.fetchNextBatch = (options) ->
				for i in [1..3]
					collection.add new Version message: "Test Snapshot #{versionCounter}"
					versionCounter++
				options.success() if options.success?

			@view = new VersionListView
				collection : @collection
			@view.$el.css height: "200px"
			$("#test-area").append(@view.$el)

		afterEach ->
			@view.$el.remove()

		it "should add versions to the list as they are added to the collection", ->
			@collection.add	new Version	message : "Test Snapshot 1"
			@collection.add	new Version	message : "Test Snapshot 2"
			should.equal $(@view.$(".version-message")[0]).text(), "Test Snapshot 1"
			should.equal $(@view.$(".version-message")[1]).text(), "Test Snapshot 2"

		it "should load more versions when scrolled to the end", (done) ->
			# Add enough versions to make the list long enough to scroll
			originalVersions = 10
			for i in [1..originalVersions]
				@collection.add new Version message: "Test Snapshot"

			@view.$el.scrollTop(10000) # Should get us to the bottom

			collection = @collection
			setTimeout (() ->
				should.equal collection.models.length > originalVersions, true
				done()
			), 0

		it "should load more versions when the list does not take up the whole view", (done) ->
			view = @view
			@view.loadUntilFull null, () ->
				should.equal view.$("#version-list").height() > view.$el.height(), true
				should.equal view.collection.models.length > 0, true
				done()

		it "should stop loading versions if the collection returns an error", (done) ->
			@collection.fetchNextBatch = (options) ->
				options.error() if options.error?
			view = @view
			@view.loadUntilFull null, () ->
				should.equal view.collection.models.length, 0
				done()

		it "should show the empty message if the collection is empty after fetching", (done) ->
			@collection.pop() until @collection.isEmpty()
			@collection.fetchNextBatch = (options) ->
				# error callback is triggered on 404
				options.error() if options.error()

			@view.loadUntilFull null, () =>
				@view.$(".empty-message").is(":visible").should.equal true
				done()
