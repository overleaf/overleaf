define -> [
	# 	regexToMatch: /Too many }'s/
	# 	extraInfoURL: ""
	# 	humanReadableHint: """
	# 		The reason LaTeX thinks there are too many }'s here is that the opening curly brace is missing after the <tt>\\date</tt> control sequence and before the word December, so the closing curly brace is seen as one too many (which it is!).
	# 	"""
	# ,
	# 	regexToMatch: /Undefined control sequence/
	# 	extraInfoURL: "/learn/Errors:Undefined_control_sequence."
	# 	humanReadableHint: """
	# 		In this example, LaTeX is complaining that it has no such command ("control sequence") as <tt>\\dtae</tt>. Obviously it's been mistyped, but only a human can detect that fact: all LaTeX knows is that <tt>\\dtae</tt> is not a command it knows about: it's undefined.
	# 	"""
	# ,
	# 	regexToMatch: /Missing \$ inserted/
	# 	extraInfoURL: "/learn/Errors:Missing_$_inserted"
	# 	humanReadableHint: """
	# 		A character that can only be used in the mathematics was inserted in normal text. If you intended to use mathematics mode, then use <tt>$...$</tt> or <tt>\\begin{math}...\\end{math}</tt> or use the 'quick math mode': <tt>\\ensuremath{...}</tt>.
	# 	"""
	# ,
	# 	regexToMatch: /Runaway argument/
	# 	extraInfoURL: "/learn/Errors:Undefined_control_sequence."
	# 	humanReadableHint: """
	# 		In this error, the closing curly brace has been omitted from the date. It's the opposite of the error of too many }'s, and it results in <tt>\\maketitle</tt> trying to format the title page while LaTeX is still expecting more text for the date!
	# 	"""
	# ,
	# 	regexToMatch: /Underfull \\hbox/
	# 	extraInfoURL: "/learn/Errors:Underfull_%5Chbox"
	# 	humanReadableHint: """
	# 		This is a warning that LaTeX cannot stretch the line wide enough to fit, without making the spacing bigger than its currently permitted maximum. The badness (0-10,000) indicates how severe this is (here you can probably ignore a badness of 1394).
	# 	"""
	# ,
	# 	regexToMatch: /Overfull \\hbox/
	# 	extraInfoURL: ""
	# 	humanReadableHint: """
	# 		An overfull \\hbox means that there is a hyphenation or justification problem: moving the last word on the line to the next line would make the spaces in the line wider than the current limit; keeping the word on the line would make the spaces smaller than the current limit, so the word is left on the line, but with the minimum allowed space between words, and which makes the line go over the edge.
	# 	"""
	# ,
	# 	regexToMatch: /LaTeX Error: File .* not found/
	# 	extraInfoURL: "/learn/Errors:missing_package"
	# 	humanReadableHint: """
	# 		When you use the <tt>\\usepackage</tt> command to request LaTeX to use a certain package, it will look for a file with the specified name and the filetype <tt>.sty</tt>. In this case the user has mistyped the name of the paralist package, so it's easy to fix.
	# 		"""
]
