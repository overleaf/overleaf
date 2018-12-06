ENGINE_TO_COMPILER_MAP = {
	latex_dvipdf: "latex"
	pdflatex:     "pdflatex"
	xelatex:      "xelatex"
	lualatex:     "lualatex"
}

module.exports = ProjectHelper =
	compilerFromV1Engine: (engine) ->
		return ENGINE_TO_COMPILER_MAP[engine]

	ensureNameIsUnique: (nameList, name, suffixes = [], maxLength, callback = (error, name, changed)->) ->
		# create a set of all project names
		allNames = new Set(nameList)
		isUnique = (x) -> !allNames.has(x)
		# check if the supplied name is already unique
		if isUnique(name)
			return callback(null, name, false)
		# the name already exists, try adding the user-supplied suffixes to generate a unique name
		for suffix in suffixes
			candidateName = ProjectHelper._addSuffixToProjectName(name, suffix, maxLength)
			if isUnique(candidateName)
				return callback(null, candidateName, true)
		# if there are no (more) suffixes, use a numeric one
		uniqueName = ProjectHelper._addNumericSuffixToProjectName(name, allNames, maxLength)
		if uniqueName?
			callback(null, uniqueName, true)
		else
			callback(new Error("Failed to generate a unique name for: #{name}"))

	_addSuffixToProjectName: (name, suffix = '', maxLength) ->
		# append the suffix and truncate the project title if needed
		truncatedLength = maxLength - suffix.length
		return name.substr(0, truncatedLength) + suffix

	_addNumericSuffixToProjectName: (name, allProjectNames, maxLength) ->
		NUMERIC_SUFFIX_MATCH = / \((\d+)\)$/
		suffixedName = (basename, number) ->
			suffix = " (#{number})"
			return basename.substr(0, maxLength - suffix.length) + suffix

		match = name.match(NUMERIC_SUFFIX_MATCH)
		basename = name
		n = 1
		last = allProjectNames.size + n

		if match?
			basename = name.replace(NUMERIC_SUFFIX_MATCH, '')
			n = parseInt(match[1])

		while n <= last
			candidate = suffixedName(basename, n)
			return candidate unless allProjectNames.has(candidate)
			n += 1

		return null