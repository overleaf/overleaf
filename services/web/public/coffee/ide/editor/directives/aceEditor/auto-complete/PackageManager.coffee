define [
	"./Helpers"
], (Helpers) ->
	packages = [
		'inputenc', 'graphicx', 'amsmath', 'geometry', 'amssymb', 'hyperref',
		'babel', 'color', 'xcolor', 'url', 'natbib', 'fontenc', 'fancyhdr',
		'amsfonts', 'booktabs', 'amsthm', 'float', 'tikz', 'caption',
		'setspace', 'multirow', 'array', 'multicol', 'titlesec', 'enumitem',
		'ifthen', 'listings', 'blindtext', 'subcaption', 'times', 'bm',
		'subfigure', 'algorithm', 'fontspec', 'biblatex', 'tabularx',
		'microtype', 'etoolbox', 'parskip', 'calc', 'verbatim', 'mathtools',
		'epsfig', 'wrapfig', 'lipsum', 'cite', 'textcomp', 'longtable',
		'textpos', 'algpseudocode', 'enumerate', 'subfig', 'pdfpages',
		'epstopdf', 'latexsym', 'lmodern', 'pifont', 'ragged2e', 'rotating',
		'dcolumn', 'xltxtra', 'marvosym', 'indentfirst', 'xspace', 'csquotes',
		'xparse', 'changepage', 'soul', 'xunicode', 'comment', 'mathrsfs',
		'tocbibind', 'lastpage', 'algorithm2e', 'pgfplots', 'lineno',
		'graphics', 'algorithmic', 'fullpage', 'mathptmx', 'todonotes',
		'ulem', 'tweaklist', 'moderncvstyleclassic', 'collection',
		'moderncvcompatibility', 'gensymb', 'helvet', 'siunitx', 'adjustbox',
		'placeins', 'colortbl', 'appendix', 'makeidx', 'supertabular', 'ifpdf',
		'framed', 'aliascnt', 'layaureo', 'authblk'
	]

	class PackageManager
		constructor: (@metadataManager) ->

		getCompletions: (editor, session, pos, prefix, callback) ->
			{closingBrace} = Helpers.getContext(editor, pos)
			usedPackages = Object.keys(@metadataManager.getAllPackages())
			packageSnippets = []
			for pkg in packages
				if pkg not in usedPackages
					packageSnippets.push {
						caption: "\\usepackage{#{pkg}#{closingBrace}"
						snippet: "\\usepackage{#{pkg}#{closingBrace}"
						meta: "pkg"
					}

			packageSnippets.push {
				caption: "\\usepackage{}"
				snippet: "\\usepackage{$1}"
				meta: "pkg"
				score: 70
			}
			callback null, packageSnippets

	return PackageManager
