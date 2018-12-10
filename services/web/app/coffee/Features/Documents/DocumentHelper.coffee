module.exports = DocumentHelper =
	getTitleFromTexContent: (content, maxContentToScan = 30000) ->
		TITLE_WITH_CURLY_BRACES = /\\[tT]itle\*?\s*{([^}]+)}/
		TITLE_WITH_SQUARE_BRACES = /\\[tT]itle\s*\[([^\]]+)\]/
		for line in DocumentHelper._getLinesFromContent(content, maxContentToScan)
			if match = line.match(TITLE_WITH_CURLY_BRACES) || line.match(TITLE_WITH_SQUARE_BRACES)
				return DocumentHelper.detex(match[1])

		return null

	contentHasDocumentclass: (content, maxContentToScan = 30000) ->
		for line in DocumentHelper._getLinesFromContent(content, maxContentToScan)
			# We've had problems with this regex locking up CPU.
			# Previously /.*\\documentclass/ would totally lock up on lines of 500kb (data text files :()
			# This regex will only look from the start of the line, including whitespace so will return quickly
			# regardless of line length.
			return true if line.match /^\s*\\documentclass/

		return false

	detex: (string) ->
		return string.replace(/\\LaTeX/g, 'LaTeX')
			.replace(/\\TeX/g, 'TeX')
			.replace(/\\TikZ/g, 'TikZ')
			.replace(/\\BibTeX/g, 'BibTeX')
			.replace(/\\\[[A-Za-z0-9. ]*\]/g, ' ') # line spacing
			.replace(/\\(?:[a-zA-Z]+|.|)/g, '')
			.replace(/{}|~/g, ' ')
			.replace(/[${}]/g, '')
			.replace(/ +/g, ' ')
			.trim()

	_getLinesFromContent: (content, maxContentToScan) ->
		return if typeof content is 'string' then content.substring(0, maxContentToScan).split("\n") else content
