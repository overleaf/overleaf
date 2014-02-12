require ["libs/mocha", "libs/underscore", "libs/jquery"], ->
	mocha.setup({
		ui: "bdd",
		globals: ["now", "socket"]
	})
	require [
		"tests/unit/UndoManagerTests"
		"tests/unit/history/FileDiff"
		"tests/unit/history/VersionListView"
		"tests/unit/history/HistoryView"
		"tests/unit/spelling/HighlightedWordManagerTests"
		"tests/unit/spelling/SpellingManagerTests"
		"tests/unit/auto-complete/SuggestionManager"
		"tests/unit/project-members"
		"tests/unit/user"
		"tests/unit/project"
		"tests/unit/modal"
		"tests/unit/editor/DocumentTests"
		"tests/unit/editor/ShareJsDocTests"
	], ->
		mocha.run()
