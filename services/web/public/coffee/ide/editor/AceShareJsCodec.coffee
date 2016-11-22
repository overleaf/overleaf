define [], () ->
	AceShareJsCodec =
		aceRangeToShareJs: (range, lines) ->
			offset = 0
			for line, i in lines
				offset += if i < range.row
					line.length
				else
					range.column
			offset += range.row # Include newlines
			return offset
		
		aceChangeToShareJs: (delta, lines) ->
			offset = AceShareJsCodec.aceRangeToShareJs(delta.start, lines)

			text = delta.lines.join('\n')
			switch delta.action
				when 'insert'
					return { i: text, p: offset }
				when 'remove'
					return { d: text, p: offset }
				else throw new Error "unknown action: #{delta.action}"
		
		shareJsOffsetToAcePosition: (offset, lines) ->
			row = 0
			for line, row in lines
				break if offset <= line.length
				offset -= lines[row].length + 1 # + 1 for newline char
			return {row:row, column:offset}