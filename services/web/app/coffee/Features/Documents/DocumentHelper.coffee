module.exports = DocumentHelper =
	getTitleFromTexContent: (content, maxContentToScan = 30000) ->
		TITLE_WITH_CURLY_BRACES = /\\[tT]itle\*?\s*{([^}]+)}/
		TITLE_WITH_SQUARE_BRACES = /\\[tT]itle\s*\[([^\]]+)\]/
		ESCAPED_BRACES = /\\([{}\[\]])/g
		content = content.substring(0, maxContentToScan).split("\n") if typeof content is 'string'
		title = null
		for line in content
			match = line.match(TITLE_WITH_SQUARE_BRACES) || line.match(TITLE_WITH_CURLY_BRACES)
			if match?
				title = match[1].replace(ESCAPED_BRACES, (br)->br[1])
				break
		return title
