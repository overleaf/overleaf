sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Compile/ClsiFormatChecker.js"
SandboxedModule = require('sandboxed-module')

describe "ClsiFormatChecker", ->
	beforeEach ->
		@ClsiFormatChecker = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings ={}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub(), warn: sinon.stub() }
		@project_id = "project-id"


	describe "checkRecoursesForProblems", ->

		beforeEach ->
			@resources = [{
				path:    "main.tex"
				content: "stuff"
			}, {
				path:    "chapters/chapter1"
				content: "other stuff"
			}, {
				path: "stuff/image/image.png"
				url:  "http:somewhere.com/project/#{@project_id}/file/1234124321312"
				modified: "more stuff"
			}]

		it "should call _checkForDuplicatePaths and _checkForConflictingPaths", (done)->

			@ClsiFormatChecker._checkForConflictingPaths = sinon.stub().callsArgWith(1, null)
			@ClsiFormatChecker._checkDocsAreUnderSizeLimit = sinon.stub().callsArgWith(1)
			@ClsiFormatChecker.checkRecoursesForProblems @resources, (err, problems)=>
				@ClsiFormatChecker._checkForConflictingPaths.called.should.equal true
				@ClsiFormatChecker._checkDocsAreUnderSizeLimit.called.should.equal true
				done()

		it "should remove undefined errors", (done)->
			@ClsiFormatChecker._checkForConflictingPaths = sinon.stub().callsArgWith(1, null, [])
			@ClsiFormatChecker._checkDocsAreUnderSizeLimit = sinon.stub().callsArgWith(1, null, {})
			@ClsiFormatChecker.checkRecoursesForProblems @resources, (err, problems)=>
				expect(problems).to.not.exist
				expect(problems).to.not.exist
				done()

		it "should keep populated arrays", (done)->
			@ClsiFormatChecker._checkForConflictingPaths = sinon.stub().callsArgWith(1, null, [{path:"somewhere/main.tex"}])
			@ClsiFormatChecker._checkDocsAreUnderSizeLimit = sinon.stub().callsArgWith(1, null, {})
			@ClsiFormatChecker.checkRecoursesForProblems @resources, (err, problems)=>
				problems.conflictedPaths[0].path.should.equal "somewhere/main.tex"
				expect(problems.sizeCheck).to.not.exist
				done()

		it "should keep populated object", (done)->
			@ClsiFormatChecker._checkForConflictingPaths = sinon.stub().callsArgWith(1, null, [])
			@ClsiFormatChecker._checkDocsAreUnderSizeLimit = sinon.stub().callsArgWith(1, null, {resources:[{"a.tex"},{"b.tex"}], totalSize:1000000})
			@ClsiFormatChecker.checkRecoursesForProblems @resources, (err, problems)=>
				problems.sizeCheck.resources.length.should.equal 2
				problems.sizeCheck.totalSize.should.equal 1000000
				expect(problems.conflictedPaths).to.not.exist
				done()

		describe "_checkForConflictingPaths", ->

			beforeEach ->

				@resources.push({
					path:    "chapters/chapter1.tex"
					content: "other stuff"
				})

				@resources.push({
					path:    "chapters.tex"
					content: "other stuff"
				})

			it "should flag up when a nested file has folder with same subpath as file elsewhere", (done)->
				@resources.push({
					path: "stuff/image"
					url: "http://somwhere.com"
				})

				@ClsiFormatChecker._checkForConflictingPaths @resources, (err, conflictPathErrors)->
					conflictPathErrors.length.should.equal 1
					conflictPathErrors[0].path.should.equal "stuff/image"
					done()
				
			it "should flag up when a root level file has folder with same subpath as file elsewhere", (done)->
				@resources.push({
					path:    "stuff"
					content: "other stuff"
				})

				@ClsiFormatChecker._checkForConflictingPaths @resources, (err, conflictPathErrors)->
					conflictPathErrors.length.should.equal 1
					conflictPathErrors[0].path.should.equal "stuff"
					done()

			it "should not flag up when the file is a substring of a path", (done)->
				@resources.push({
					path:    "stuf"
					content: "other stuff"
				})

				@ClsiFormatChecker._checkForConflictingPaths @resources, (err, conflictPathErrors)->
					conflictPathErrors.length.should.equal 0
					done()
				

		describe "_checkDocsAreUnderSizeLimit", ->

			it "should error when there is more than 5mb of data", (done)->

				@resources.push({
					path:    "massive.tex"
					content: require("crypto").randomBytes(1000 * 1000 * 5).toString("hex")
				})

				while @resources.length < 20
					@resources.push({path:"chapters/chapter1.tex",url: "http://somwhere.com"})

				@ClsiFormatChecker._checkDocsAreUnderSizeLimit @resources, (err, sizeError)->
					sizeError.totalSize.should.equal 10000016
					sizeError.resources.length.should.equal 10
					sizeError.resources[0].path.should.equal "massive.tex"
					sizeError.resources[0].size.should.equal 1000 * 1000 * 10
					done()
			

			it "should return nothing when project is correct size", (done)->

				@resources.push({
					path:    "massive.tex"
					content: require("crypto").randomBytes(1000 * 1000 * 1).toString("hex")
				})

				while @resources.length < 20
					@resources.push({path:"chapters/chapter1.tex",url: "http://somwhere.com"})

				@ClsiFormatChecker._checkDocsAreUnderSizeLimit @resources, (err, sizeError)->
					expect(sizeError).to.not.exist
					done()







