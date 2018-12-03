module.exports = DocumentHelper =
	getTitleFromTexContent: (content, maxContentToScan = 30000) ->
		TITLE_WITH_CURLY_BRACES = /\\[tT]itle\*?\s*{([^}]+)}/
		TITLE_WITH_SQUARE_BRACES = /\\[tT]itle\s*\[([^\]]+)\]/
		ESCAPED_BRACES = /\\([{}\[\]])/g

		for line in DocumentHelper._getLinesFromContent(content, maxContentToScan)
			match = line.match(TITLE_WITH_SQUARE_BRACES) || line.match(TITLE_WITH_CURLY_BRACES)
			if match?
				return match[1].replace(ESCAPED_BRACES, (br)->br[1])

		return null

	contentHasDocumentclass: (content, maxContentToScan = 30000) ->
		for line in DocumentHelper._getLinesFromContent(content, maxContentToScan)
			# We've had problems with this regex locking up CPU.
			# Previously /.*\\documentclass/ would totally lock up on lines of 500kb (data text files :()
			# This regex will only look from the start of the line, including whitespace so will return quickly
			# regardless of line length.
			return true if line.match /^\s*\\documentclass/

		return false

	_getLinesFromContent: (content, maxContentToScan) ->
		return if typeof content is 'string' then content.substring(0, maxContentToScan).split("\n") else content
