define [
	"undo/UndoManager"
], (UndoManager) ->
	describe "UndoManager", ->
		beforeEach ->
			@undoManager = new UndoManager()

		describe "Regression Tests", ->
			describe "block commenting", ->
				it "should convert correctly", ->
					lines = ["a", "a", "a", "a"]
					simpleDeltas = [
						deltas: [
							{ insert: "%", position: 0 }
							{ insert: "%", position: 3 }
							{ insert: "%", position: 6 }
							{ insert: "%", position: 9 }
						]
						group: "doc"
					]
					aceDeltas = @undoManager._simpleDeltaSetsToAceDeltaSets(simpleDeltas, lines)
					expectedAceDeltas = [
						deltas: [{
							action: "insertText"
							text: "%"
							range:
								start: column: 0, row: 0
								end: column: 1, row: 0
						}, {
							action: "insertText"
							text: "%"
							range:
								start: column: 0, row: 1
								end: column: 1, row: 1
						}, {
							action: "insertText"
							text: "%"
							range:
								start: column: 0, row: 2
								end: column: 1, row: 2
						}, {
							action: "insertText"
							text: "%"
							range:
								start: column: 0, row: 3
								end: column: 1, row: 3
						}]
						group: "doc"
					]
					console.log aceDeltas, expectedAceDeltas
					aceDeltas.should.deep.equal expectedAceDeltas

		describe "_shiftLocalChangeToTopOfUndoStack", ->
			describe "with no local undos", ->
				beforeEach ->
					@undoManager.undoStack = [
						{ deltaSets: [], remote: true }
						{ deltaSets: [], remote: true }
					]
					@return = @undoManager._shiftLocalChangeToTopOfUndoStack()

				it "should return false", ->
					@return.should.equal false

			describe "with a local undo that can be shifted to the top", ->
				beforeEach ->
					@undoManager.undoStack = [
						{ deltaSets: [deltas: [{ position: 0, insert: "banana"}], group: "doc"], remote: true }
						{ deltaSets: [deltas: [{ position: 5, insert: "baz" }], group: "doc"], remote: false }
						{ deltaSets: [deltas: [{ position: 20, insert: "bar" }], group: "doc"], remote: true }
						{ deltaSets: [deltas: [{ position: 10, insert: "foo" }], group: "doc"], remote: true }
					]
					@return = @undoManager._shiftLocalChangeToTopOfUndoStack()

				it "should bring the local change to the top of the stack", ->
					@expected = [
						{ deltaSets: [deltas: [{ position: 0, insert: "banana"}], group: "doc"], remote: true }
						{ deltaSets: [deltas: [{ position: 17, insert: "bar" }], group: "doc"], remote: true }
						{ deltaSets: [deltas: [{ position: 7, insert: "foo" }], group: "doc"], remote: true }
						{ deltaSets: [deltas: [{ position: 5, insert: "baz" }], group: "doc"], remote: false }
					]
					@undoManager.undoStack.should.deep.equal @expected

				it "should return true", ->
					@return.should.equal true

			describe "with a local undo that cannot be brought all the way to the top", ->
				beforeEach ->
					@undoManager.undoStack = [
						{ deltaSets: [deltas: [{ position: 0, insert: "banana"}], group: "doc"], remote: true }
						{ deltaSets: [deltas: [{ position: 5, insert: "baz" }], group: "doc"], remote: false }
						{ deltaSets: [deltas: [{ position: 20, insert: "bar" }], group: "doc"], remote: true }
						{ deltaSets: [deltas: [{ position: 6, insert: "foo" }], group: "doc"], remote: true }
					]
					@return = @undoManager._shiftLocalChangeToTopOfUndoStack()

				it "should bring the change as far up the stack as possible", ->
					@expected = [
						{ deltaSets: [deltas: [{ position: 0, insert: "banana"}], group: "doc"], remote: true }
						{ deltaSets: [deltas: [{ position: 17, insert: "bar" }], group: "doc"], remote: true }
						{ deltaSets: [deltas: [{ position: 5, insert: "baz" }], group: "doc"], remote: false }
						{ deltaSets: [deltas: [{ position: 6, insert: "foo" }], group: "doc"], remote: true }
					]
					@undoManager.undoStack.should.deep.equal @expected
					
				it "should return true", ->
					@return.should.equal true

		describe "_aceDeltaToSimpleDelta", ->
			beforeEach ->
				@docLines = [
					"one",
					"two",
					"three",
					"four"
				]
				
			describe "insertText", ->
				it "should convert correctly", ->
					@aceDelta =
						action: "insertText"
						range:
							start:
								row: 2
								column: 2
							end:
								row: 2
								column: 5
						text: "foo"
					@simpleDelta = @undoManager._aceDeltaToSimpleDelta(@aceDelta, @docLines)
					@simpleDelta.should.deep.equal
						insert: "foo"
						position: 10
						
			describe "insertLines", ->
				it "should convert correctly", ->
					@aceDelta =
						action: "insertLines"
						lines: [
							"two and half"
							"two and three quarters"
						]
						range:
							start:
								row: 2
								column: 0
							end:
								row: 4
								column: 0
					@simpleDelta = @undoManager._aceDeltaToSimpleDelta(@aceDelta, @docLines)
					@simpleDelta.should.deep.equal
						insert: "two and half\ntwo and three quarters\n"
						position: 8

			describe "removeText", ->
				it "should convert correctly", ->
					@aceDelta =
						action: "removeLines"
						range:
							start:
								row: 1
								column: 0
							end:
								row: 3
								column: 0
						lines: [
							"two",
							"three"
						]
					@simpleDelta = @undoManager._aceDeltaToSimpleDelta(@aceDelta, @docLines)
					@simpleDelta.should.deep.equal
						remove: "two\nthree\n"
						position: 4

		describe "_simpleDeltaToAceDelta", ->
			describe "insert", ->
				beforeEach ->
					@docLines = [
						"one",
						"two"
						"three"
					]
				describe "with leading and trailing partial lines", ->
					it "should return insertText and insertLines ace updates", ->
						@simpleDelta =
							position: 7
							insert: "after\ntwo and a half\nbefore"
						@aceDeltas = @undoManager._simpleDeltaToAceDeltas(@simpleDelta, @docLines)
						@expected = [{
							text: "after"
							range:
								start: row: 1, column: 3
								end: row:1, column: 8
							action: "insertText"
						}, {
							text: "\n"
							range:
								start: row: 1, column: 8
								end: row:2, column: 0
							action: "insertText"
						}, {
							lines: [ "two and a half" ]
							range:
								start: row: 2, column:0
								end: row:3, column: 0
							action: "insertLines"
						}, {
							text: "before"
							range:
								start: row: 3, column:0
								end: row: 3, column: 6
							action: "insertText"
						}]
						@aceDeltas.should.deep.equal @expected
						
			describe "remove", ->
				beforeEach ->
					@docLines = [
						"one",
						"two"
						"three"
					]
				describe "with leading and trailing partial lines", ->
					it "should return insertText and insertLines ace updates", ->
						@simpleDelta =
							position: 2
							remove: "e\ntwo\nth"
						@aceDeltas = @undoManager._simpleDeltaToAceDeltas(@simpleDelta, @docLines)
						@expected = [{
							text: "th"
							range:
								start: row: 2, column:0
								end: row: 2, column: 2
							action: "removeText"
						}, {
							lines: [ "two" ]
							range:
								start: row: 1, column:0
								end: row:2, column: 0
							action: "removeLines"
						}, {
							text: "\n"
							range:
								start: row: 0, column: 3
								end: row:1, column: 0
							action: "removeText"
						}, {
							text: "e"
							range:
								start: row: 0, column: 2
								end: row: 0, column: 3
							action: "removeText"
						}]
						@aceDeltas.should.deep.equal @expected

		describe "_concatSimpleDeltas", ->
			it "should concat adjacent simple deltas", ->
				@result = @undoManager._concatSimpleDeltas [{
					insert: "foo"
					position: 5
				}, {
					insert: "bar"
					position: 8
				}, {
					insert: "baz"
					position: 11
				}, {
					insert: "one"
					position: 20
				}, {
					insert: "two"
					position: 23
				}, {
					remove: "three"
					position: 26
				}]

				@result.should.deep.equal [{
					insert: "foobarbaz"
					position: 5
				}, {
					insert: "onetwo"
					position: 20
				}, {
					remove: "three"
					position: 26
				}]
				
			it "should concat removes", ->
				@result = @undoManager._concatSimpleDeltas [{
					remove: "foo"
					position: 5
				}, {
					remove: "bar"
					position: 5
				}, {
					remove: "baz"
					position: 5
				}]

				@result.should.deep.equal [{
					remove: "foobarbaz"
					position: 5
				}]

		describe "_swapSimpleDeltaOrder", ->
			describe "insert - insert", ->
				describe "when the first delta is before the second", ->
					beforeEach ->
						# result: "**fooba"
						[@newFirstDelta, @newSecondDelta] = @undoManager._swapSimpleDeltaOrder(
							{ insert: "foo", position: 2 }
							{ insert: "ba", position: 5 }
						)

					it "should remove the length of the first insert from the second position", ->
						@newFirstDelta.should.deep.equal position: 2, insert: "ba"
						@newSecondDelta.should.deep.equal position: 2, insert: "foo"
				
				describe "when the second delta is inserted into the first", ->
					beforeEach ->
						# result "**fobao*"
						@result = @undoManager._swapSimpleDeltaOrder(
							{ insert: "foo", position: 2 }
							{ insert: "ba", position: 4 }
						)

					it "should return null", ->
						(@result?).should.equal false

				describe "when the second delta is before the first", ->
					beforeEach ->
						# result: "**bafoo"
						[@newFirstDelta, @newSecondDelta] = @undoManager._swapSimpleDeltaOrder(
							{ insert: "foo", position: 2 }
							{ insert: "ba", position: 2 }
						)

					it "should add the length of the second delta on to the first position", ->
						@newFirstDelta.should.deep.equal insert: "ba", position: 2
						@newSecondDelta.should.deep.equal insert: "foo", position: 4

			describe "remove - remove", ->
				describe "when the first delta is before the second", ->
					beforeEach ->
						# start "**fooba*
						[@newFirstDelta, @newSecondDelta] = @undoManager._swapSimpleDeltaOrder(
							{ remove: "foo", position: 2 }
							{ remove: "ba", position: 2 }
						)

					it "should add the length of the first remove onto the second position", ->
						@newFirstDelta.should.deep.equal position: 5, remove: "ba"
						@newSecondDelta.should.deep.equal position: 2, remove: "foo"

				describe "when the first and second delta overlap", ->
					beforeEach ->
						# start "**bfooa*
						@result = @undoManager._swapSimpleDeltaOrder(
							{ remove: "foo", position: 3 }
							{ remove: "ba", position: 2 }
						)

					it "should return null", ->
						(@result?).should.equal false

				describe "when the second delta is before the first", ->
					beforeEach ->
						# start "**bafoo*
						[@newFirstDelta, @newSecondDelta] = @undoManager._swapSimpleDeltaOrder(
							{ remove: "foo", position: 4 }
							{ remove: "ba", position: 2 }
						)

					it "should remove the length of the second delta from the first position", ->
						@newFirstDelta.should.deep.equal position: 2, remove: "ba"
						@newSecondDelta.should.deep.equal position: 2, remove: "foo"

			describe "insert - remove", ->
				describe "when the first delta is before the second", ->
					beforeEach ->
						# "**ba" -> "**fooba" -> "**foo"
						[@newFirstDelta, @newSecondDelta] = @undoManager._swapSimpleDeltaOrder(
							{ insert: "foo", position: 2 }
							{ remove: "ba", position: 5 }
						)

					it "should remove the length of the first delta from the second position", ->
						@newFirstDelta.should.deep.equal position: 2, remove: "ba"
						@newSecondDelta.should.deep.equal position: 2, insert: "foo"

				describe "when the deltas overlap", ->
					beforeEach ->
						# "**ba" -> "**bfooa" -> "**ooa"
						@result = @undoManager._swapSimpleDeltaOrder(
							{ insert: "foo", position: 3 }
							{ remove: "bf", position: 2 }
						)

					it "should return null", ->
						(@result?).should.equal false

				describe "when the second delta is before the first", ->
					beforeEach ->
						# "**ba" -> "**bafoo" -> "**foo"
						[@newFirstDelta, @newSecondDelta] = @undoManager._swapSimpleDeltaOrder(
							{ insert: "foo", position: 4 }
							{ remove: "ba", position: 2 }
						)

					it "should remove the length of the second delta from the first position", ->
						@newFirstDelta.should.deep.equal position: 2, remove: "ba"
						@newSecondDelta.should.deep.equal position: 2, insert: "foo"

			describe "remove - insert", ->
				describe "when the first delta is before the second", ->
					beforeEach ->
						# "**foo" -> "**" -> "**ba"
						[@newFirstDelta, @newSecondDelta] = @undoManager._swapSimpleDeltaOrder(
							{ remove: "foo", position: 2 }
							{ insert: "ba", position: 2 }
						)

					it "should add the length of the first delta to the second position", ->
						@newFirstDelta.should.deep.equal position: 5, insert: "ba"
						@newSecondDelta.should.deep.equal position: 2, remove: "foo"

				# I don't think the deltas can overlap in this case!

				describe "when the first delta is after the second", ->
					beforeEach ->
						# "**foo" -> "**" -> "*ba*"
						[@newFirstDelta, @newSecondDelta] = @undoManager._swapSimpleDeltaOrder(
							{ remove: "foo", position: 2 }
							{ insert: "ba", position: 1 }
						)

					it "should add the length of the second delta on to the first position", ->
						@newFirstDelta.should.deep.equal position: 1, insert: "ba"
						@newSecondDelta.should.deep.equal position: 4, remove: "foo"
						

						


						
						

						
					
						
					
						
						
					
