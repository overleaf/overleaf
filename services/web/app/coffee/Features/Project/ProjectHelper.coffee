ENGINE_TO_COMPILER_MAP = {
	latex_dvipdf: "latex"
	pdflatex:     "pdflatex"
	xelatex:      "xelatex"
	lualatex:     "lualatex"
}

module.exports =
	compilerFromV1Engine: (engine) ->
		return ENGINE_TO_COMPILER_MAP[engine]
