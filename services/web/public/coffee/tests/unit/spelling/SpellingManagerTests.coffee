define [
	"spelling/SpellingManager"
	"libs/chai"
], 	(SpellingManager, chai) ->
	should = chai.should()
	
	describe "SpellingManager", ->
		beforeEach ->
			@el = $("<div/>")
			$("#test-area").append(@el)
			window.userSettings =
				spellCheckLanguage: "en"
			@lines = []
			@project =
				attributes: {}
				get: (attribute) -> @attributes[attribute]
			@ide =
				editor:
					on: () ->
					getLines: => @lines
					getContainerElement: () => @el
				project: @project
			_.extend(@ide, Backbone.Events)
			_.extend(@project, Backbone.Events)
			@spellingManager = new SpellingManager(@ide)
			@ide.trigger "afterJoinProject", @project

		describe "runSpellCheck", ->
			beforeEach ->
				@misspellings = [
					{ row: 1, column: 2, word: "bussines", index: 1, suggestions: ["business"] }
					{ row: 4, column: 0, word: "misteak", index: 2, suggestions: ["mistake"] }
				]
				@words =
					words: ["sharelatex", "bussines", "misteak"]
					positions: [
						{ row: 0, column: 5 },
						{ row: 1, column: 2 },
						{ row: 4, column: 0 }
					]
				@spellingManager.getWords = () => @words
				sinon.spy @spellingManager, "getWords"
				@spellingManager.apiRequest = (endpoint, data, callback) => callback null, misspellings: @misspellings
				@spellingManager.highlightedWordManager.clearRows = sinon.stub()
				@spellingManager.highlightedWordManager.addHighlight = sinon.stub()

			describe "with no argument", ->
				beforeEach ->
					@spellingManager.runSpellCheck()
					
				it "should clear all of the existing highlights", ->
					@spellingManager.highlightedWordManager.clearRows.calledWithExactly().should.equal true

				it "should add in highlights for all misspellings", ->
					for misspelling, i in @misspellings
						highlight =
							row: misspelling.row
							column: misspelling.column
							word: misspelling.word
							suggestions: misspelling.suggestions
						@spellingManager.highlightedWordManager.addHighlight.args[i][0]
							.should.deep.equal highlight

				it "should get all words", ->
					@spellingManager.getWords.calledWithExactly(undefined).should.equal true

			describe "with specified lines", ->
				beforeEach ->
					@spellingManager.runSpellCheck(@lines = [false, true, false, true])

				it "should only get words on the given lines", ->
					@spellingManager.getWords.calledWithExactly(@lines).should.equal true

				it "should only clear the given rows of highlights", ->
					@spellingManager.highlightedWordManager.clearRows.calledWithExactly(1,1).should.equal true
					@spellingManager.highlightedWordManager.clearRows.calledWithExactly(3,3).should.equal true
					
		describe "markLinesAsUpdated", ->
			describe "inserts on a single line", ->
				beforeEach ->
					@spellingManager.markLinesAsUpdated
						action: "insertText"
						range:
							start: { row: 1, column: 3 }
							end: { row: 1, column: 8 }

				it "should mark the line as updated", ->
					@spellingManager.updatedLines[1].should.equal true

			describe "inserts on multiple lines", ->
				beforeEach ->
					@spellingManager.updatedLines = [false, false, false, false, true]
					@spellingManager.markLinesAsUpdated
						action: "insertText"
						range:
							start: { row: 1, column: 3 }
							end: { row: 3, column: 8 }
					
				it "should mark the lines as updated", ->
					@spellingManager.updatedLines[1].should.equal true
					@spellingManager.updatedLines[2].should.equal true
					@spellingManager.updatedLines[3].should.equal true

				it "should move existing lines", ->
					@spellingManager.updatedLines[4].should.equal false
					@spellingManager.updatedLines[6].should.equal true

			describe "deletes on a single line", ->
				beforeEach ->
					@spellingManager.markLinesAsUpdated
						action: "removeText"
						range:
							start: { row: 1, column: 3 }
							end: { row: 1, column: 8 }

				it "should mark the line as updated", ->
					@spellingManager.updatedLines[1].should.equal true

			describe "deletes on multiple lines", ->
				beforeEach ->
					@spellingManager.updatedLines = [false, false, false, false, false, true]
					@spellingManager.markLinesAsUpdated
						action: "removeText"
						range:
							start: { row: 1, column: 3 }
							end: { row: 3, column: 8 }
					
				it "should mark the lines as updated", ->
					@spellingManager.updatedLines[1].should.equal true

				it "should move existing lines", ->
					@spellingManager.updatedLines[3].should.equal true

			describe "insertLines", ->
				beforeEach ->
					@spellingManager.updatedLines = [false, false, false, false, true]
					@spellingManager.markLinesAsUpdated
						action: "insertLines"
						range:
							start: { row: 1, column: 0 }
							end: { row: 3, column: 0 }

				it "should mark the lines as updated", ->
					@spellingManager.updatedLines[1].should.equal true
					@spellingManager.updatedLines[2].should.equal true

				it "should move existing lines", ->
					@spellingManager.updatedLines[4].should.equal false
					@spellingManager.updatedLines[6].should.equal true

			describe "removeLines", ->
				beforeEach ->
					@spellingManager.updatedLines = [false, false, false, false, true]
					@spellingManager.markLinesAsUpdated
						action: "removeLines"
						range:
							start: { row: 1, column: 0 }
							end: { row: 3, column: 0 }

				it "should move existing lines", ->
					@spellingManager.updatedLines.length.should.equal 3
					@spellingManager.updatedLines[2].should.equal true

		describe "getWords", ->
			describe "with no argument", ->
				beforeEach ->
					@lines = [
						"\\documentclass{article}"
						"\\begin{document}"
						"Hello world"
						"\\end{document}"
					]
					{@words, @positions} = @spellingManager.getWords()
				 
				it "should return all of the words", ->
					@words.should.deep.equal [
						"\\documentclass", "article", "\\begin", "document", "Hello", "world", "\\end", "document"
					]

				it "should return the correct positions", ->
					@positions.length.should.equal @words.length
					@positions[5].should.deep.equal row: 2, column: 6

			describe "with selective lines", ->
				beforeEach ->
					@lines = [
						"zero"
						"one uno"
						"two dos"
						"three"
					]
					{@words, @positions} = @spellingManager.getWords([false, true, true, false])
				 
				it "should only return words from the given lines", ->
					@words.should.deep.equal [
						"one", "uno", "two", "dos"
					]

			describe "with accents", ->
				beforeEach ->
					@lines = ["accént"]
					{@words, @positions} = @spellingManager.getWords()

				it "should treat the accented character as a letter", ->
					@words.should.deep.equal ["accént"]

			describe "with single quote marks", ->
				beforeEach ->
					@lines = ["you'll 'words appear in quotes' and with apostrophe's"]
					{@words, @positions} = @spellingManager.getWords()

				it "should understand the difference between apostophes and quotes", ->
					@words.should.deep.equal [
						"you'll", "words", "appear", "in", "quotes", "and", "with", "apostrophe's"
					]



