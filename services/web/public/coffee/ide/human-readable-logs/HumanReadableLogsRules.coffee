define -> [
		regexToMatch: /Too many }'s/
		humanReadableMessage: "The reason LaTeX thinks there are too many }'s 
		here is that the opening curly brace is missing after the \\date control 
		sequence and before the word December, so the closing curly brace is 
		seen as one too many (which it is!). In fact, there are other things 
		which can follow the \\date command apart from a date in curly braces, 
		so LaTeX cannot possibly guess that you've missed out the opening curly 
		brace until it finds a closing one!"
	,
		regexToMatch: /Undefined control sequence/
		humanReadableMessage: "In this example, LaTeX is complaining that it has
		no such command (\"control sequence\") as \\dtae. Obviously it's been 
		mistyped, but only a human can detect that fact: all LaTeX knows is that
		\\dtae is not a command it knows about: it's undefined. Mistypings are 
		the most common source of errors. Some editors allow common commands and
		environments to be inserted using drop-down menus or icons, which may
		be used to avoid these errors."
	,
		regexToMatch: /Missing \$ inserted/
		humanReadableMessage: "A character that can only be used in the
		mathematics was inserted in normal text. If you intended to use
		mathematics mode, then use $...$ or \\begin{math}...\\end{math} or use 
		the 'quick math mode': \ensuremath{...}. If you did not intend to use 
		mathematics mode, then perhaps you are trying to use a special character
		that needs to be entered in a different way; for example _ will be 
		interpreted as a subscript operator in mathematics mode, and you need 
		\\_ to get an underscore character.

		This can also happen if you use the wrong character encoding, for 
		example using utf8 without \"\\usepackage[utf8]{inputenc}\" or using 
		iso8859-1 without \"\\usepackage[latin1]{inputenc}\", there are several 
		character encoding formats, make sure to pick the right one."
	,
		regexToMatch: /Runaway argument/
		humanReadableMessage: "In this error, the closing curly brace has been 
		omitted from the date. It's the opposite of the error of too many }'s, 
		and it results in \\maketitle trying to format the title page while 
		LaTeX is still expecting more text for the date! As \\maketitle creates 
		new paragraphs on the title page, this is detected and LaTeX complains 
		that the previous paragraph has ended but \\date is not yet finished."
	,
		regexToMatch: /Underfull \\hbox/
		humanReadableMessage: "This is a warning that LaTeX cannot stretch the 
		line wide enough to fit, without making the spacing bigger than its 
		currently permitted maximum. The badness (0-10,000) indicates how severe
		this is (here you can probably ignore a badness of 1394). It says what 
		lines of your file it was typesetting when it found this, and the number
		in square brackets is the number of the page onto which the offending 
		line was printed. The codes separated by slashes are the typeface and 
		font style and size used in the line. Ignore them for the moment.

		This comes up if you force a linebreak, e.g., \\\\, and have a return 
		before it. Normally TeX ignores linebreaks, providing full paragraphs to
		ragged text. In this case it is necessary to pull the linebreak up one 
		line to the end of the previous sentence.

		This warning may also appear when inserting images. It can be avoided by
		using the \\textwidth or possibly \\linewidth options, e.g. 
		\\includegraphics[width=\\textwidth]{image_name}"
	,
		regexToMatch: /Overfull \\hbox/
		humanReadableMessage: "An overfull \hbox means that there is a 
		hyphenation or justification problem: moving the last word on the line 
		to the next line would make the spaces in the line wider than the 
		current limit; keeping the word on the line would make the spaces 
		smaller than the current limit, so the word is left on the line, but 
		with the minimum allowed space between words, and which makes the line 
		go over the edge.

		The warning is given so that you can find the line in the code that 
		originates the problem (in this case: 860-861) and fix it. The line on
		this example is too long by a shade over 9pt. The chosen hyphenation 
		point which minimizes the error is shown at the end of the line (Win-). 
		Line numbers and page numbers are given as before. In this case, 9pt is 
		too much to ignore (over 3mm), and a manual correction needs making 
		(such as a change to the hyphenation), or the flexibility settings need 
		changing.

		If the \"overfull\" word includes a forward slash, such as 
		\"input/output\", this should be properly typeset as \"input\\slash 
		output\". The use of \\slash has the same effect as using the \"/\" 
		character, except that it can form the end of a line (with the following
		words appearing at the start of the next line). The \"/\" character is 
		typically used in units, such as \"mm/year\" character, which should not 
		be broken over multiple lines.

		The warning can also be issued when the \\end{document} tag was not 
		included or was deleted."
	,
		regexToMatch: /LaTeX Error: File .* not found/
		humanReadableMessage: "When you use the \\usepackage command to request 
		LaTeX to use a certain package, it will look for a file with the 
		specified name and the filetype .sty. In this case the user has mistyped 
		the name of the paralist package, so it's easy to fix. However, if you 
		get the name right, but the package is not installed on your machine, 
		you will need to download and install it before continuing. If you don't
		want to affect the global installation of the machine, you can simply 
		download from Internet the necessary .sty file and put it in the same 
		folder of the document you are compiling."
]

