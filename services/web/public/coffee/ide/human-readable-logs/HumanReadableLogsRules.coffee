define -> [
		regexToMatch: /Misplaced alignment tab character \&/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:Misplaced_alignment_tab_character_%26"
		humanReadableHint: """
			You have placed an alignment tab character '&' in the wrong place. If you want to align something, you must write it inside an align environment such as \\begin{align} \u2026 \\end{align}, \\begin{tabular} \u2026 \\end{tabular}, etc. If you want to write an ampersand '&' in text, you must write \\& instead.
		"""
	,
		regexToMatch: /Extra alignment tab has been changed to \\cr/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:Extra_alignment_tab_has_been_changed_to_%5Ccr"
		humanReadableHint: """
			You have written too many alignment tabs in a table, causing one of them to be turned one of them into a line break. Make sure you have specified the correct number of columns in your [table](https://www.sharelatex.com/learn/Tables).
		"""
	,
		regexToMatch: /Display math should end with \$\$/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:Display_math_should_end_with_$$."
		humanReadableHint: """
			You have forgotten a $ sign at the end of 'display math' mode. When writing in \u2018display math' mode, you must always math write inside $$ \u2026 $$. Check that the number of $s match around maths.
		"""
	,
		regexToMatch: /Missing [{$] inserted./
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:Missing_$_inserted"
		humanReadableHint: """
			Check that your $s match around maths. If they do, then you've probably used a symbol in normal text that needs to be in math mode. Sybols such as subscripts ( _ ), integrals ( \\int ), Greek letters ( \\alpha, \\beta, \\delta ), and modifiers (\\vec{x}, \\tilde{x} ) must be written in math mode. See the full list [here](https://www.sharelatex.com/learn/Errors:Missing_$_inserted). If you intended to use mathematics mode, then use $ \u2026 $ or \\begin{math} \u2026 \\end{math} or use the \u2018quick math mode\u2019: \\ensuremath{...}.
		"""
	,
		regexToMatch: /(undefined )?[rR]eference(s)?.+(undefined)?/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:There_were_undefined_references."
		humanReadableHint: """
			You have referenced something which has not yet been labeled. If you have labeled it already, make sure that what is written inside \\ref{...} is the same as what is written inside \\label{...}.
		"""
	,
		regexToMatch: /Citation .+ on page .+ undefined on input line .+/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:Citation_XXX_on_page_XXX_undefined_on_input_line_XXX."
		humanReadableHint: """
			You have cited something which has not been included in the bibliography. Make sure that the citation (\\cite{...}) has a corresponding label in your bibliography, and that both are spelled the same way.
		"""
	,
		regexToMatch: /(Label .+)? multiply[ -]defined( labels)?/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:There_were_multiply-defined_labels."
		humanReadableHint: """
			You have used the same label more than once. Check that each \\label{...} labels only one item.
		"""
	,
		regexToMatch: /`!h' float specifier changed to `!ht'/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:%60!h%27_float_specifier_changed_to_%60!ht%27."
		humanReadableHint: """
			The float specifier '!h' is too strict of a demand for LaTeX to place our float in a nice way here. Try relaxing it by using 'ht', or even 'htbp' if necessary. If you want to try to keep the float here anyway, check out the [float package](https://www.sharelatex.com/learn/Errors:%60!h%27_float_specifier_changed_to_%60!ht%27.).
		"""
	,
		regexToMatch: /`h' float specifier changed to `ht'/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:%60!h%27_float_specifier_changed_to_%60!ht%27."
		humanReadableHint: """
			The float specifier 'h' is too strict of a demand for LaTeX to place our float in a nice way here. Try relaxing it by using 'ht', or even 'htbp' if necessary. If you want to try keep the float here anyway, check out the [float package](https://www.sharelatex.com/learn/Positioning_of_Figures).
		"""
	,
		regexToMatch: /No positions in optional float specifier/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:No_positions_in_optional_float_specifier."
		humanReadableHint: """
			You have forgotten to include a float specifier, which tells LaTeX where to position your figure. Find out more about float specifiers [here](https://www.sharelatex.com/learn/Positioning_of_Figures).
		"""
	,
		regexToMatch: /Undefined control sequence/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:Undefined_control_sequence."
		humanReadableHint: """
			The compiler is having trouble understanding a command you have used. Check that the command is spelled correctly. If the command is part of a package, make sure you have included the package in your preamble using \\usepackage{...}.
		"""
	,
		regexToMatch: /File .+ not found/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:File_XXX_not_found_on_input_line_XXX."
		humanReadableHint: """
			The compiler cannot find the file you want to include. Make sure that you have [uploaded the file](https://www.sharelatex.com/learn/Including_images_in_ShareLaTeX) and [specified the file location correctly](https://www.sharelatex.com/learn/Errors:File_XXX_not_found_on_input_line_XXX.).
		"""
	,
		regexToMatch: /LaTeX Error: Unknown graphics extension: \..+/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:LaTeX_Error:_Unknown_graphics_extension:_.gif."
		humanReadableHint: """
			The compiler does not recognise the file type of one of your images. Make sure you are using a [supported image format](https://www.sharelatex.com/learn/Errors:LaTeX_Error:_Unknown_graphics_extension:_.gif.) for your choice of compiler, and check that there are no full stops in the name of your image.
		"""
	,
		regexToMatch: /LaTeX Error: Unknown float option `H'/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:LaTeX_Error:_Unknown_float_option_%60H%27."
		humanReadableHint: """
			The compiler isn't recognizing the float option 'H'. Include \\usepackage{float} in your preamble to fix this.
		"""
	,
		regexToMatch: /LaTeX Error: Unknown float option `P'/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:LaTeX_Error:_Unknown_float_option_%60H%27."
		humanReadableHint: """
			You have used a float specifier which the compiler does not understand. The only extra float option provided by the 'float' package is 'H'. You can learn more about the different float options available for placing figures in our [documentation](https://www.sharelatex.com/learn/Positioning_of_Figures).
		"""
	,
		regexToMatch: /LaTeX Error: Unknown float option `.+'/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:LaTeX_Error:_Unknown_float_option_%60H%27."
		humanReadableHint: """
			You have used a float specifier which the compiler does not understand. You can learn more about the different float options available for placing figures [here](https://www.sharelatex.com/learn/Positioning_of_Figures).
		"""
	,
		regexToMatch: /LaTeX Error: \\math.+ allowed only in math mode/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:LaTeX_Error:_%5Cmathrm_allowed_only_in_math_mode."
		humanReadableHint: """
			You have used a font which is only available in math mode. To use this font, you must write it in mathematics mode by using $ \u2026 $ or \\begin{math} \u2026 \\end{math}, or using the \u2018quick math mode\u2019: \\ensuremath{...}.
		"""
]
