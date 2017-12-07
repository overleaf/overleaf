Path = require 'path'
SandboxedModule = require "sandboxed-module"
modulePath = Path.join __dirname, '../../../public/js/ide/history/HistoryManager'
sinon = require("sinon")
expect = require("chai").expect

describe "HistoryManager", ->
	beforeEach ->
		@moment = {}
		@ColorManager = {}
		SandboxedModule.require modulePath, globals:
			"define": (dependencies, builder) =>
				@HistoryManager = builder(@moment, @ColorManager)

		@scope =
			$watch: sinon.stub()
			$on: sinon.stub()
		@ide = {}

		@historyManager = new @HistoryManager(@ide, @scope)

	it "should setup the history scope on intialization", ->
		expect(@scope.history).to.deep.equal({
			updates: []
			nextBeforeTimestamp: null
			atEnd: false
			selection: {
				updates: []
				doc: null
				range: {
					fromV: null
					toV: null
				}
			}
			diff: null
		})

	describe "_perDocSummaryOfUpdates", ->
		it "should return the range of updates for the docs", ->
			result = @historyManager._perDocSummaryOfUpdates([{
				docs: ["main.tex"]
				fromV: 7, toV: 9
			},{
				docs: ["main.tex", "foo.tex"]
				fromV: 4, toV: 6
			},{
				docs: ["main.tex"]
				fromV: 3, toV: 3
			},{
				docs: ["foo.tex"]
				fromV: 0, toV: 2
			}])

			expect(result).to.deep.equal({
				"main.tex": { fromV: 3, toV: 9 },
				"foo.tex": { fromV: 0, toV: 6 }
			})

		it "should track renames", ->
			result = @historyManager._perDocSummaryOfUpdates([{
				docs: ["main2.tex"]
				fromV: 5, toV: 9
			},{
				project_ops: [{
					rename: {
						pathname: "main1.tex",
						newPathname: "main2.tex"
					}
				}],
				fromV: 4, toV: 4
			},{
				docs: ["main1.tex"]
				fromV: 3, toV: 3
			},{
				project_ops: [{
					rename: {
						pathname: "main0.tex",
						newPathname: "main1.tex"
					}
				}],
				fromV: 2, toV: 2
			},{
				docs: ["main0.tex"]
				fromV: 0, toV: 1
			}])

			expect(result).to.deep.equal({
				"main0.tex": { fromV: 0, toV: 9 }
			})
