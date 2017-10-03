define () ->
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

	packageSnippets = for pkg in packages
		{
			caption: "\\usepackage{#{pkg}}"
			snippet: """\\usepackage{#{pkg}}"""
			meta: "pkg"
		}

	packageSnippets.push {
		caption: "\\usepackage{}"
		snippet: "\\usepackage{}"
		meta: "pkg"
		score: 70
	}

	class PackageManager
		getCompletions: (editor, session, pos, prefix, callback) ->
			docText = session.getValue()
			loaded = parseLoadedPackages(docText)
			# console.log loaded
			callback null, packageSnippets

	return PackageManager
