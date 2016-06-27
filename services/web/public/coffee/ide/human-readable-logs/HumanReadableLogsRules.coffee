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
			You have written too many alignment tabs in a table, causing one of them to be turned into a line break. Make sure you have specified the correct number of columns in your <a target=\"_blank\" href=\"https://www.sharelatex.com/learn/Tables\">table</a>.
		"""
	,
		regexToMatch: /Display math should end with \$\$/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:Display_math_should_end_with_$$."
		humanReadableHint: """
			You have forgotten a $ sign at the end of 'display math' mode. When writing in display math mode, you must always math write inside $$ \u2026 $$. Check that the number of $s match around each math expression.
		"""
	,
		regexToMatch: /Missing [{$] inserted./
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:Missing_$_inserted"
		humanReadableHint: """
			Check that your $'s match around math expressions. If they do, then you've probably used a symbol in normal text that needs to be in math mode. Symbols such as subscripts ( _ ), integrals ( \\int ), Greek letters ( \\alpha, \\beta, \\delta ), and modifiers (\\vec{x}, \\tilde{x} ) must be written in math mode. See the full list <a target=\"_blank\" href=\"https://www.sharelatex.com/learn/Errors:Missing_$_inserted\">here</a>.
		"""
	,
		regexToMatch: /(undefined )?[rR]eference(s)?.+(undefined)?/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:There_were_undefined_references."
		humanReadableHint: """
			You have referenced something which has not yet been labelled. If you have labelled it already, make sure that what is written inside \\ref{...} is the same as what is written inside \\label{...}.
		"""
	,
		regexToMatch: /Citation .+ on page .+ undefined on input line .+/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:Citation_XXX_on_page_XXX_undefined_on_input_line_XXX."
		humanReadableHint: """
			You have cited something which is not included in your bibliography. Make sure that the citation (\\cite{...}) has a corresponding key in your bibliography, and that both are spelled the same way.
		"""
	,
		regexToMatch: /(Label .+)? multiply[ -]defined( labels)?/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:There_were_multiply-defined_labels."
		humanReadableHint: """
			You have used the same label more than once. Check that each \\label{...} labels only one item.
		"""
	,
		regexToMatch: /`!?h' float specifier changed to `!?ht'/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:%60!h%27_float_specifier_changed_to_%60!ht%27."
		humanReadableHint: """
			The float specifier 'h' is too strict of a demand for LaTeX to place your float in a nice way here. Try relaxing it by using 'ht', or even 'htbp' if necessary. If you want to try keep the float here anyway, check out the <a target=\"_blank\" href=\"https://www.sharelatex.com/learn/Positioning_of_Figures\">float package</a>.
		"""
	,
		regexToMatch: /No positions in optional float specifier/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:No_positions_in_optional_float_specifier."
		humanReadableHint: """
			You have forgotten to include a float specifier, which tells LaTeX where to position your figure. Find out more about float specifiers <a target=\"_blank\" href=\"https://www.sharelatex.com/learn/Positioning_of_Figures\">here</a>.
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
			The compiler cannot find the file you want to include. Make sure that you have <a target=\"_blank\" href=\"https://www.sharelatex.com/learn/Including_images_in_ShareLaTeX\">uploaded the file</a> and <a target=\"_blank\" href=\"https://www.sharelatex.com/learn/Errors:File_XXX_not_found_on_input_line_XXX.\">specified the file location correctly</a>.
		"""
	,
		regexToMatch: /LaTeX Error: Unknown graphics extension: \..+/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:LaTeX_Error:_Unknown_graphics_extension:_.gif."
		humanReadableHint: """
			The compiler does not recognise the file type of one of your images. Make sure you are using a <a target=\"_blank\" href=\"https://www.sharelatex.com/learn/Errors:LaTeX_Error:_Unknown_graphics_extension:_.gif.\">supported image format</a> for your choice of compiler, and check that there are no periods (.) in the name of your image.
		"""
	,
		regexToMatch: /LaTeX Error: Unknown float option `H'/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:LaTeX_Error:_Unknown_float_option_%60H%27."
		humanReadableHint: """
			The compiler isn't recognizing the float option 'H'. Include \\usepackage{float} in your preamble to fix this.
		"""
	,
		regexToMatch: /LaTeX Error: Unknown float option `.+'/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:LaTeX_Error:_Unknown_float_option_%60H%27."
		humanReadableHint: """
			You have used a float specifier which the compiler does not understand. You can learn more about the different float options available for placing figures <a target=\"_blank\" href=\"https://www.sharelatex.com/learn/Positioning_of_Figures\">here</a>.
		"""
	,
		regexToMatch: /LaTeX Error: \\math.+ allowed only in math mode/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors:LaTeX_Error:_%5Cmathrm_allowed_only_in_math_mode."
		humanReadableHint: """
			You have used a font command which is only available in math mode. To use this command, you must be in maths mode (E.g. $ \u2026 $ or \\begin{math} \u2026 \\end{math}). If you want to use it outside of math mode, use the text version instead: \\textrm, \\textit, etc.
		"""
]
