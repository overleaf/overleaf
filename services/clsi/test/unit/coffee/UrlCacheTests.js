SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/UrlCache'
EventEmitter = require("events").EventEmitter

describe "UrlCache", ->
	beforeEach ->
		@callback = sinon.stub()
		@url = "www.example.com/file"
		@project_id = "project-id-123"
		@UrlCache = SandboxedModule.require modulePath, requires:
			"./db" : {}
			"./UrlFetcher" : @UrlFetcher = {}
			"logger-sharelatex": @logger = {log: sinon.stub()}
			"settings-sharelatex": @Settings = { path: clsiCacheDir: "/cache/dir" }
			"fs": @fs = {}
	
	describe "_doesUrlNeedDownloading", ->
		beforeEach ->
			@lastModified = new Date()
			@lastModifiedRoundedToSeconds = new Date(Math.floor(@lastModified.getTime() / 1000) * 1000)

		describe "when URL does not exist in cache", ->
			beforeEach ->
				@UrlCache._findUrlDetails = sinon.stub().callsArgWith(2, null, null)
				@UrlCache._doesUrlNeedDownloading(@project_id, @url, @lastModified, @callback)

			it "should return the callback with true", ->
				@callback.calledWith(null, true).should.equal true

		describe "when URL does exist in cache", ->
			beforeEach ->
				@urlDetails = {}
				@UrlCache._findUrlDetails = sinon.stub().callsArgWith(2, null, @urlDetails)

			describe "when the modified date is more recent than the cached modified date", ->
				beforeEach ->
					@urlDetails.lastModified = new Date(@lastModified.getTime() - 1000)
					@UrlCache._doesUrlNeedDownloading(@project_id, @url, @lastModified, @callback)

				it "should get the url details", ->
					@UrlCache._findUrlDetails
						.calledWith(@project_id, @url)
						.should.equal true

				it "should return the callback with true", ->
					@callback.calledWith(null, true).should.equal true

			describe "when the cached modified date is more recent than the modified date", ->
				beforeEach ->
					@urlDetails.lastModified = new Date(@lastModified.getTime() + 1000)
					@UrlCache._doesUrlNeedDownloading(@project_id, @url, @lastModified, @callback)

				it "should return the callback with false", ->
					@callback.calledWith(null, false).should.equal true

			describe "when the cached modified date is equal to the modified date", ->
				beforeEach ->
					@urlDetails.lastModified = @lastModified
					@UrlCache._doesUrlNeedDownloading(@project_id, @url, @lastModified, @callback)

				it "should return the callback with false", ->
					@callback.calledWith(null, false).should.equal true

			describe "when the provided modified date does not exist", ->
				beforeEach ->
					@lastModified = null
					@UrlCache._doesUrlNeedDownloading(@project_id, @url, @lastModified, @callback)

				it "should return the callback with true", ->
					@callback.calledWith(null, true).should.equal true

			describe "when the URL does not have a modified date", ->
				beforeEach ->
					@urlDetails.lastModified = null
					@UrlCache._doesUrlNeedDownloading(@project_id, @url, @lastModified, @callback)

				it "should return the callback with true", ->
					@callback.calledWith(null, true).should.equal true

	describe "_ensureUrlIsInCache", ->
		beforeEach ->
			@UrlFetcher.pipeUrlToFile = sinon.stub().callsArg(2)
			@UrlCache._updateOrCreateUrlDetails = sinon.stub().callsArg(3)
			
		describe "when the URL needs updating", ->
			beforeEach ->
				@UrlCache._doesUrlNeedDownloading = sinon.stub().callsArgWith(3, null, true)
				@UrlCache._ensureUrlIsInCache(@project_id, @url, @lastModified, @callback)

			it "should check that the url needs downloading", ->
				@UrlCache._doesUrlNeedDownloading
					.calledWith(@project_id, @url, @lastModifiedRoundedToSeconds)
					.should.equal true

			it "should download the URL to the cache file", ->
				@UrlFetcher.pipeUrlToFile
					.calledWith(@url, @UrlCache._cacheFilePathForUrl(@project_id, @url))
					.should.equal true
				

			it "should update the database entry", ->
				@UrlCache._updateOrCreateUrlDetails
					.calledWith(@project_id, @url, @lastModifiedRoundedToSeconds)
					.should.equal true

			it "should return the callback with the cache file path", ->
				@callback
					.calledWith(null, @UrlCache._cacheFilePathForUrl(@project_id, @url))
					.should.equal true

		describe "when the URL does not need updating", ->
			beforeEach ->
				@UrlCache._doesUrlNeedDownloading = sinon.stub().callsArgWith(3, null, false)
				@UrlCache._ensureUrlIsInCache(@project_id, @url, @lastModified, @callback)
				
			it "should not download the URL to the cache file", ->
				@UrlFetcher.pipeUrlToFile
					.called.should.equal false

			it "should return the callback with the cache file path", ->
				@callback
					.calledWith(null, @UrlCache._cacheFilePathForUrl(@project_id, @url))
					.should.equal true

	describe "downloadUrlToFile", ->
		beforeEach ->
			@cachePath = "path/to/cached/url"
			@destPath = "path/to/destination"
			@UrlCache._copyFile = sinon.stub().callsArg(2)
			@UrlCache._ensureUrlIsInCache = sinon.stub().callsArgWith(3, null, @cachePath)
			@UrlCache.downloadUrlToFile(@project_id, @url, @destPath, @lastModified, @callback)

		it "should ensure the URL is downloaded and updated in the cache", ->
			@UrlCache._ensureUrlIsInCache
				.calledWith(@project_id, @url, @lastModified)
				.should.equal true

		it "should copy the file to the new location", ->
			@UrlCache._copyFile
				.calledWith(@cachePath, @destPath)
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "_deleteUrlCacheFromDisk", ->
		beforeEach ->
			@fs.unlink = sinon.stub().callsArg(1)
			@UrlCache._deleteUrlCacheFromDisk(@project_id, @url, @callback)

		it "should delete the cache file", ->
			@fs.unlink
				.calledWith(@UrlCache._cacheFilePathForUrl(@project_id, @url))
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "_clearUrlFromCache", ->
		beforeEach ->
			@UrlCache._deleteUrlCacheFromDisk = sinon.stub().callsArg(2)
			@UrlCache._clearUrlDetails = sinon.stub().callsArg(2)
			@UrlCache._clearUrlFromCache @project_id, @url, @callback

		it "should delete the file on disk", ->
			@UrlCache._deleteUrlCacheFromDisk
				.calledWith(@project_id, @url)
				.should.equal true

		it "should clear the entry in the database", ->
			@UrlCache._clearUrlDetails
				.calledWith(@project_id, @url)
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "clearProject", ->
		beforeEach ->
			@urls = [
				"www.example.com/file1"
				"www.example.com/file2"
			]
			@UrlCache._findAllUrlsInProject = sinon.stub().callsArgWith(1, null, @urls)
			@UrlCache._clearUrlFromCache = sinon.stub().callsArg(2)
			@UrlCache.clearProject @project_id, @callback

		it "should clear the cache for each url in the project", ->
			for url in @urls
				@UrlCache._clearUrlFromCache
					.calledWith(@project_id, url)
					.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true
			
				

