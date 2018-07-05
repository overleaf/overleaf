define () ->
	envs = [
		"abstract",
		"align", "align*",
		"equation", "equation*",
		"gather", "gather*",
		"multline", "multline*",
		"split",
		"verbatim",
		"quote",
		"center"
	]

	envsWithSnippets = [
		"array",
		"figure",
		"tabular",
		"table",
		"list",
		"enumerate",
		"itemize",
		"frame",
		"thebibliography"
	]

	return {
		all: envs.concat(envsWithSnippets)
		withoutSnippets: envs
	}