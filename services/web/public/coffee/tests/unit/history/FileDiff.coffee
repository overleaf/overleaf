define [
	"libs/chai"
	"history/FileDiff"
	"history/FileDiffView"
	"libs/sinon"
], (chai, FileDiff, FileDiffView) ->
	should = chai.should()

	describe "FileDiffView", ->
		describe "Updated text", ->
			beforeEach ->
				@model = new FileDiff
					path: "dir/file"
					type: "updated"
					sections: [{
						old_start_line: 5,
						new_start_line: 7,
						lines : [
							{ type: "unchanged", content: "line 5" },
							{ type: "removed", content: "removed line" },
							{ type: "added", content: "added line" },
							{ type: "unchanged", content: "line 7" }
						]
					}, {
						old_start_line: 12,
						new_start_line: 12,
						lines : [
							{ type: "unchanged", content: "line 12" },
							{ type: "removed", content: "removed line" },
							{ type: "added", content: "added line" },
							{ type: "unchanged", content: "line 14" }
						]
					}]
				@view = new FileDiffView
					model : @model
				@view.render()

			it "should render a pretty version of the diff", ->
				htmlLines = @view.$(".line")
				lines = for line in htmlLines
					old_line_number: $(line).find(".old_line_number").text()
					new_line_number: $(line).find(".new_line_number").text()
					symbol:          $(line).find(".symbol").text()
					content:         $(line).find(".content").text()
				
				lines[0].should.deep.equal(old_line_number: "5", new_line_number: "7", symbol: "",  content: "line 5")
				lines[1].should.deep.equal(old_line_number: "6", new_line_number: "",  symbol: "-", content: "removed line")
				lines[2].should.deep.equal(old_line_number: "",  new_line_number: "8", symbol: "+", content: "added line")
				lines[3].should.deep.equal(old_line_number: "7", new_line_number: "9", symbol: "",  content: "line 7")

				lines[4].should.deep.equal(old_line_number: "12", new_line_number: "12", symbol: "",  content: "line 12")
				lines[5].should.deep.equal(old_line_number: "13", new_line_number: "",   symbol: "-", content: "removed line")
				lines[6].should.deep.equal(old_line_number: "",   new_line_number: "13", symbol: "+", content: "added line")
				lines[7].should.deep.equal(old_line_number: "14", new_line_number: "14", symbol: "",  content: "line 14")

			it "should load the raw file when clicked", ->
				model = @model
				@model.fetch = (options) ->
					@set("content", "Test content")
					options.success(model) if options.success?

				@view.$(".rawFileContent").text().should.equal "Loading..."
				@view.$(".nav .raw").click()
				@view.$(".rawFileContent").text().should.equal "Test content"

		describe "Deleted text", ->
			beforeEach ->
				@model = new FileDiff
					path: "dir/file"
					type: "deleted"
					sections: [{
						old_start_line: 12,
						new_start_line: 12,
						lines : [
							{ type: "removed", content: "line 12" }
						]
					}]
				@view = new FileDiffView
					model : @model
				@view.render()
				
			it "shouldn't show a link to the raw file", ->
				@view.$(".nav .raw").length.should.equal 0

		describe "Blank diff", ->
			beforeEach ->
				@model = new FileDiff
					path: "dir/file"
					type: "deleted"
				@view = new FileDiffView
					model : @model
				@view.render()
				
			it "shouldn't show a diff", ->
				@view.$(".tab-diff").length.should.equal 0
				

		describe "Updated binary file", ->
			beforeEach ->
				@model = new FileDiff
					binary:     true
					path:       "dir/file"
					version_id: "123"
					type:       "updated"
				@view = new FileDiffView
					model : @model
				@view.render()

			it "should display a link to the file", ->
				@view.$("a.rawFileLink").attr("href").should.equal "/project/#{userSettings.project_id}/version/123/file/dir/file"
	
		describe "Deleted binary file", ->
			beforeEach ->
				@model = new FileDiff
					binary: true
					type:   "deleted"
				@view = new FileDiffView
					model : @model
				@view.render()
				
			it "should not display a link to the file", ->
				@view.$("a.rawFileLink").length.should.equal 0
				

		describe "Moved file", ->
			beforeEach ->
				@model = new FileDiff
					path:    "new-path"
					oldPath: "old-path"
					type:    "renamed"
				@view = new FileDiffView
					model : @model
				@view.render()

			it "should say the file was moved", ->
				@view.$("h3").text().should.equal("old-path")
				@view.$(".fileMoved").text().should.equal("Moved to new-path")
			

			
