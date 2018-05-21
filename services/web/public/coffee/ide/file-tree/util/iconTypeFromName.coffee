define [], () ->
	return iconTypeFromName = (name) ->
		ext = name.split(".").pop()?.toLowerCase()
		if ext in ["png", "pdf", "jpg", "jpeg", "gif"]
			return "image"
		else if ext in ["csv", "xls", "xlsx"]
			return "table"
		else if ext in ["py", "r"]
			return "file-text"
		else if ext in ['bib']
			return 'book'
		else
			return "file"