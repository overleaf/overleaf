define [
	"auto-complete/SuggestionManager"
	"libs/chai"
], (SuggestionManager, chai) ->
	should = chai.should()

	describe "SuggestionManager", ->
		beforeEach ->
			@suggestionManager = new SuggestionManager()

		describe "loadCommandsFromDoc", ->
			it "should return commands with no arguments", ->
				@suggestionManager.loadCommandsFromDoc """
					\\alpha
					\\beta \\gamma
				"""
				@suggestionManager.commands.should.deep.equal [
					["alpha", 0, 0]
					["beta", 0, 0]
					["gamma", 0, 0]
				]

			it "should return commands with arguments", ->
				@suggestionManager.loadCommandsFromDoc """
					\\begin{document}
					\\includegraphics[width=10pt]{foo.png}
					\\frac{1}{2}
				"""
				@suggestionManager.commands.should.deep.equal [
					["begin", 0, 1]
					["includegraphics", 1, 1]
					["frac", 0, 2]
				]

			it "should not care about whitespace between arguments", ->
				@suggestionManager.loadCommandsFromDoc """
					\\includegraphics
					\t [blah]
					\t\t {woo}
				"""
				@suggestionManager.commands.should.deep.equal [
					["includegraphics", 1, 1]
				]

			it "should parse nested commands", ->
				@suggestionManager.loadCommandsFromDoc """
					\\frac{
						\\overbrace{1}{2}
					}{2}
				"""
				@suggestionManager.commands.should.deep.equal [
					["frac", 0, 2]
					["overbrace", 0, 2]
				]

			it "should not duplicate commands", ->
				@suggestionManager.loadCommandsFromDoc """
					\\frac{2}{3}
					\\frac{4}{5}
				"""
				@suggestionManager.commands.should.deep.equal [
					["frac", 0, 2]
				]

				
				
	

