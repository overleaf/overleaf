define ['ide/history/HistoryV2Manager'], (HistoryV2Manager) ->
	describe "HistoryV2Manager", ->
		beforeEach ->
			@scope =
				$watch: sinon.stub()
				$on: sinon.stub()
			@ide = {}
			@historyManager = new HistoryV2Manager(@ide, @scope)

		it "should setup the history scope on intialization", ->
			expect(@scope.history).to.deep.equal({
				isV2: true
				updates: []
				nextBeforeTimestamp: null
				atEnd: false
				selection: {
					updates: []
					pathname: null
					docs: {}
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
					pathnames: ["main.tex"]
					fromV: 7, toV: 9
				},{
					pathnames: ["main.tex", "foo.tex"]
					fromV: 4, toV: 6
				},{
					pathnames: ["main.tex"]
					fromV: 3, toV: 3
				},{
					pathnames: ["foo.tex"]
					fromV: 0, toV: 2
				}])

				expect(result).to.deep.equal({
					"main.tex": { fromV: 3, toV: 9 },
					"foo.tex": { fromV: 0, toV: 6 }
				})

			it "should track renames", ->
				result = @historyManager._perDocSummaryOfUpdates([{
					pathnames: ["main2.tex"]
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
					pathnames: ["main1.tex"]
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
					pathnames: ["main0.tex"]
					fromV: 0, toV: 1
				}])

				expect(result).to.deep.equal({
					"main0.tex": { fromV: 0, toV: 9 }
				})

			it "should track single renames", ->
				result = @historyManager._perDocSummaryOfUpdates([{
					project_ops: [{
						rename: {
							pathname: "main1.tex",
							newPathname: "main2.tex"
						}
					}],
					fromV: 4, toV: 5
				}])

				expect(result).to.deep.equal({
					"main1.tex": { fromV: 4, toV: 5 }
				})

			it "should track additions", ->
				result = @historyManager._perDocSummaryOfUpdates([{
					project_ops: [{
						add:
							pathname: "main.tex"
					}]
					fromV: 0, toV: 1
				}, {
					pathnames: ["main.tex"]
					fromV: 1, toV: 4
				}])

				expect(result).to.deep.equal({
					"main.tex": { fromV: 0, toV: 4 }
				})

			it "should track single additions", ->
				result = @historyManager._perDocSummaryOfUpdates([{
					project_ops: [{
						add:
							pathname: "main.tex"
					}]
					fromV: 0, toV: 1
				}])

				expect(result).to.deep.equal({
					"main.tex": { fromV: 0, toV: 1 }
				})

			it "should track deletions", ->
				result = @historyManager._perDocSummaryOfUpdates([{
					pathnames: ["main.tex"]
					fromV: 0, toV: 1
				}, {
					project_ops: [{
						remove:
							pathname: "main.tex"
							atV: 2
					}]
					fromV: 1, toV: 2
				}])

				expect(result).to.deep.equal({
					"main.tex": { fromV: 0, toV: 2, deletedAtV: 2 }
				})

			it "should track single deletions", ->
				result = @historyManager._perDocSummaryOfUpdates([{
					project_ops: [{
						remove:
							pathname: "main.tex"
							atV: 1
					}]
					fromV: 0, toV: 1
				}])

				expect(result).to.deep.equal({
					"main.tex": { fromV: 0, toV: 1, deletedAtV: 1 }
				})
