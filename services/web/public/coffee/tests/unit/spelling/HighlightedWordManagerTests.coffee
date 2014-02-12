define [
	"spelling/HighlightedWordManager"
	"libs/chai"
], 	(HighlightedWordsManager, chai) ->
	should = chai.should()

	describe "HighlightedWordsManager", ->
		beforeEach ->
			@currentMarkerId = 0
			@ide =
				editor:
					addMarker: () => ++@currentMarkerId
					removeMarker: sinon.stub()
			sinon.spy @ide.editor, "addMarker"
			@highlightedWordsManager = new HighlightedWordsManager(@ide)
			@highlightedWordsManager.doesHighlightExist = (row, column, word) ->
				for highlight in @highlights.rows[row]
					if highlight.row == row and highlight.column == column and highlight.word == word
						return true
				return false

		describe "addHighlight", ->
			beforeEach ->
				@highlightedWordsManager.addHighlight
					row: 1
					column: 5
					word: "sharelatex"

			it "should add a marker into ace", ->
				@ide.editor.addMarker.called.should.equal true
				[options, klass] = @ide.editor.addMarker.args[0]
				options.should.deep.equal row: 1, column: 5, length: 10
				klass.should.equal "sharelatex-spelling-highlight"

			it "should record the highlight internally", ->
				row = @highlightedWordsManager.highlights.rows[1]
				highlight = row[0]
				highlight.word.should.equal "sharelatex"
				highlight.markerId.should.equal @currentMarkerId

		describe "removeHighlight", ->
			beforeEach ->
				@highlightedWordsManager.addHighlight row: 0, column: 5, word: "sharelatex"
				@highlightedWordsManager.addHighlight row: 0, column: 17, word: "sharelatex"
				@highlightedWordsManager.addHighlight row: 0, column: 42, word: "sharelatex"
				@highlight = @highlightedWordsManager.highlights.rows[0][1]
				@highlightedWordsManager.removeHighlight @highlight

			it "should remove the marker", ->
				@ide.editor.removeMarker.calledWith(@highlight.markerId).should.equal true

			it "should remove the highlight internally", ->
				@highlightedWordsManager.doesHighlightExist(0, 17, "sharelatex").should.equal false

		describe "removeWord", ->
			beforeEach ->
				@highlightedWordsManager.addHighlight row: 0, column: 5, word: "sharelatex"
				@highlightedWordsManager.addHighlight row: 1, column: 5, word: "banana"
				@highlightedWordsManager.addHighlight row: 3, column: 5, word: "sharelatex"
				@highlightedWordsManager.addHighlight row: 4, column: 5, word: "monkey"
				@highlightedWordsManager.removeWord "sharelatex"

			it "should remove all instances of the word", ->
				@highlightedWordsManager.doesHighlightExist(0, 5, "sharelatex").should.equal false
				@highlightedWordsManager.doesHighlightExist(3, 5, "sharelatex").should.equal false

			it "should not remove other highlights", ->
				@highlightedWordsManager.doesHighlightExist(1, 5, "banana").should.equal true
				@highlightedWordsManager.doesHighlightExist(4, 5, "monkey").should.equal true

		describe "moveHighlight", ->
			beforeEach ->
				@highlightedWordsManager.addHighlight row: 0, column: 5, word: "sharelatex"
				@highlight = @highlightedWordsManager.highlights.rows[0][0]
				@oldMarkerId = @highlight.markerId
				@highlightedWordsManager.moveHighlight @highlight, row: 1, column: 17

			it "should remove the old marker", ->
				@ide.editor.removeMarker.calledWith(@oldMarkerId).should.equal true

			it "should insert a new marker", ->
				@ide.editor.addMarker.calledWith(
					{row: 1, column: 17, length: 10},
					"sharelatex-spelling-highlight"
				).should.equal true

			it "should move the highlight internally", ->
				@highlightedWordsManager.doesHighlightExist(0, 5, "sharelatex").should.equal false
				@highlightedWordsManager.doesHighlightExist(1, 17, "sharelatex").should.equal true

		describe "clearHighlights", ->
			beforeEach ->
				@highlightedWordsManager.addHighlight row: 0, column: 5, word: "sharelatex"
				@highlightedWordsManager.addHighlight row: 1, column: 5, word: "sharelatex"
				@highlightedWordsManager.addHighlight row: 3, column: 5, word: "sharelatex"
				@highlightedWordsManager.addHighlight row: 4, column: 5, word: "sharelatex"

			describe "with a range", ->
				beforeEach ->
					@highlightedWordsManager.clearRows 1, 3

				it "should clear the given rows", ->
					@highlightedWordsManager.doesHighlightExist(1, 5, "sharelatex").should.equal false
					@highlightedWordsManager.doesHighlightExist(3, 5, "sharelatex").should.equal false

				it "should not clear the other rows", ->
					@highlightedWordsManager.doesHighlightExist(0, 5, "sharelatex").should.equal true
					@highlightedWordsManager.doesHighlightExist(4, 5, "sharelatex").should.equal true

			describe "with no range", ->
				beforeEach ->
					@highlightedWordsManager.clearRows()

				it "should clear all the rows", ->
					@highlightedWordsManager.doesHighlightExist(0, 5, "sharelatex").should.equal false
					@highlightedWordsManager.doesHighlightExist(1, 5, "sharelatex").should.equal false
					@highlightedWordsManager.doesHighlightExist(3, 5, "sharelatex").should.equal false
					@highlightedWordsManager.doesHighlightExist(4, 5, "sharelatex").should.equal false


		describe "applyChange", ->
			beforeEach ->
				@highlightedWordsManager.addHighlight row: 0, column: 5, word: "sharelatex"
				@highlightedWordsManager.addHighlight row: 0, column: 17, word: "latex"
				@highlightedWordsManager.addHighlight row: 0, column: 25, word: "monkey"
				@highlightedWordsManager.addHighlight row: 1, column: 5, word: "banana"

			describe "inserting text into a single line", ->
				beforeEach ->
					@highlightedWordsManager.applyChange
						action: "insertText"
						range:
							start:
								row: 0
								column: 17
							end:
								row: 0
								column: 22
						text: "share"

				it "should move highlights after the change", ->
					@highlightedWordsManager.doesHighlightExist(0, 25, "monkey").should.equal false
					@highlightedWordsManager.doesHighlightExist(0, 30, "monkey").should.equal true

				it "should remove highlights affected by the change", ->
					@highlightedWordsManager.doesHighlightExist(0, 17, "latex").should.equal false

				it "should not affect highlights before the change", ->
					@highlightedWordsManager.doesHighlightExist(0, 5, "sharelatex").should.equal true

			describe "inserting text into multiple lines", ->
				beforeEach ->
					@highlightedWordsManager.applyChange
						action: "insertText"
						range:
							start:
								row: 0
								column: 18
							end:
								row: 1
								column: 0
						text: "\n"

				it "should move highlights after the change onto the new line", ->
					@highlightedWordsManager.doesHighlightExist(0, 25, "monkey").should.equal false
					@highlightedWordsManager.doesHighlightExist(1, 7, "monkey").should.equal true

				it "should remove highlights affected by the change", ->
					@highlightedWordsManager.doesHighlightExist(0, 17, "latex").should.equal false

				it "should not affect highlights before the change", ->
					@highlightedWordsManager.doesHighlightExist(0, 5, "sharelatex").should.equal true

			describe "inserting lines", ->
				beforeEach ->
					@highlightedWordsManager.applyChange
						action: "insertLines"
						range:
							start:
								row: 1
								column: 0
							end:
								row: 3
								column: 0
						lines: ["", ""]

				it "should move the highlights after the inserted lines", ->
					@highlightedWordsManager.doesHighlightExist(1, 5, "banana").should.equal false
					@highlightedWordsManager.doesHighlightExist(3, 5, "banana").should.equal true

				it "should not affect highlights before the inserted lines", ->
					@highlightedWordsManager.doesHighlightExist(0, 5, "sharelatex").should.equal true

			describe "deleting text from a single line", ->
				beforeEach ->
					@highlightedWordsManager.applyChange
						action: "removeText"
						range:
							start:
								row: 0
								column: 19
							end:
								row: 0
								column: 20
						text: "t"

				it "should move highlights after the change", ->
					@highlightedWordsManager.doesHighlightExist(0, 25, "monkey").should.equal false
					@highlightedWordsManager.doesHighlightExist(0, 24, "monkey").should.equal true

				it "should remove highlights affected by the change", ->
					@highlightedWordsManager.doesHighlightExist(0, 17, "latex").should.equal false

				it "should not affect highlights before the change", ->
					@highlightedWordsManager.doesHighlightExist(0, 5, "sharelatex").should.equal true

			describe "deleting text from a multiple lines", ->
				beforeEach ->
					@highlightedWordsManager.applyChange
						action: "removeText"
						range:
							start:
								row: 0
								column: 27
							end:
								row: 1
								column: 3

				it "should move highlights after the change onto the first line", ->
					@highlightedWordsManager.doesHighlightExist(1, 5, "banana").should.equal false
					@highlightedWordsManager.doesHighlightExist(0, 29, "banana").should.equal true

				it "should remove highlights affected by the change", ->
					@highlightedWordsManager.doesHighlightExist(0, 25, "monkey").should.equal false

				it "should not affect highlights before the change", ->
					@highlightedWordsManager.doesHighlightExist(0, 5, "sharelatex").should.equal true

			describe "deleting lines", ->
				beforeEach ->
					@highlightedWordsManager.applyChange
						action: "removeLines"
						range:
							start:
								row: 0
								column: 0
							end:
								row: 1
								column: 0
						lines: [""]

				it "should move the highlights after the inserted lines", ->
					@highlightedWordsManager.doesHighlightExist(1, 5, "banana").should.equal false
					@highlightedWordsManager.doesHighlightExist(0, 5, "banana").should.equal true

				it "should remove the highlights in the removed lines", ->
					@highlightedWordsManager.doesHighlightExist(0, 5, "sharelatex").should.equal false

		describe "findHighlightWithinRange", ->
			beforeEach ->
				@highlightedWordsManager.addHighlight row: 0, column: 5, word: "sharelatex"
				@highlightedWordsManager.addHighlight row: 0, column: 17, word: "latex"
				@highlightedWordsManager.addHighlight row: 0, column: 25, word: "monkey"
				@highlightedWordsManager.addHighlight row: 1, column: 5, word: "banana"

			describe "with range inside word", ->
				beforeEach ->
					@highlight = @highlightedWordsManager.findHighlightWithinRange
						start: row: 0, column: 6
						end: row: 0, column: 7

				it "should return the highlight", ->
					@highlight.row.should.equal 0
					@highlight.column.should.equal 5
					@highlight.word.should.equal "sharelatex"

			describe "with range outside word", ->
				beforeEach ->
					@highlight = @highlightedWordsManager.findHighlightWithinRange
						start: row: 0, column: 3
						end: row: 0, column: 4

				it "should return null", ->
					should.not.exist @highlight

			describe "with range equal to word", ->
				beforeEach ->
					@highlight = @highlightedWordsManager.findHighlightWithinRange
						start: row: 0, column: 5
						end: row: 0, column: 15

				it "should return null", ->
					@highlight.row.should.equal 0
					@highlight.column.should.equal 5
					@highlight.word.should.equal "sharelatex"
