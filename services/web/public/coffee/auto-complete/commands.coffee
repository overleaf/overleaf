define () -> [
	# [<command>, <square brackets args>, <curly bracket args>]
	# E.g. ["includegraphics", 1 ,1] => \includegraphics[]{}

	# Common
	["emph", 0, 1]

	# Greek letters
	["alpha", 0, 0]
	["beta", 0, 0]
	["gamma", 0, 0]
	["delta", 0, 0]
	["eta", 0, 0]
	["theta", 0, 0]
	["iota", 0, 0]
	["kappa", 0, 0]
	["lambda", 0, 0]
	["phi", 0, 0]
	["psi", 0, 0]
	["mu", 0, 0]
	["nu", 0, 0]
	["chi", 0, 0]
	["xsi", 0, 0]
	["upsilon", 0, 0]
	["Lambda", 0, 0]
	["Omega", 0, 0]
	["Gamma", 0, 0]
	["Delta", 0, 0]

	# Maths
	["infty", 0, 0]
	["frac", 0, 2]
	["int", 0, 0]
	["sum", 0, 0]
	["sin", 0, 0]
	["cos", 0, 0]

	# LaTeX commands
	["begin", 0, 1]
	["end", 0, 1]
	["includegraphics", 0, 1]
	["includegraphics", 1, 1]
	["section", 0, 1]
	["chapter", 0, 1]
	["subsection", 0, 1]
	["subsubsection", 0, 1]
	["part", 0, 1]
	["author", 0, 1]
	["title", 0, 1]
	["documentclass", 0, 1]
	["documentclass", 1, 1]
	["usepackage", 0, 1]
	["usepackage", 1, 1]

	# Font commands
	["textit", 0, 1]
	["textrm", 0, 1]
	["textsf", 0, 1]
	["texttt", 0, 1]

	["newcommand", 0, 2]
	["renewcommand", 0, 2]
	["newenvironment", 0, 3]
]
