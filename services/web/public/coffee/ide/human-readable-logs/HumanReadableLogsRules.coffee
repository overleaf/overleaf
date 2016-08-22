define -> [
		regexToMatch: /Misplaced alignment tab character \&/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/Misplaced_alignment_tab_character_%26"
		humanReadableHint: """
			You have placed an alignment tab character '&' in the wrong place. If you want to align something, you must write it inside an align environment such as \\begin{align} \u2026 \\end{align}, \\begin{tabular} \u2026 \\end{tabular}, etc. If you want to write an ampersand '&' in text, you must write \\& instead.
		"""
	,
		regexToMatch: /Extra alignment tab has been changed to \\cr/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/Extra_alignment_tab_has_been_changed_to_%5Ccr"
		humanReadableHint: """
			You have written too many alignment tabs in a table, causing one of them to be turned into a line break. Make sure you have specified the correct number of columns in your <a target=\"_blank\" href=\"https://www.sharelatex.com/learn/Tables\">table</a>.
		"""
	,
		regexToMatch: /Display math should end with \$\$/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/Display_math_should_end_with_$$"
		humanReadableHint: """
			You have forgotten a $ sign at the end of 'display math' mode. When writing in display math mode, you must always math write inside $$ \u2026 $$. Check that the number of $s match around each math expression.
		"""
	,
		regexToMatch: /Missing [{$] inserted./
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/Missing_$_inserted"
		humanReadableHint: """
			Check that your $'s match around math expressions. If they do, then you've probably used a symbol in normal text that needs to be in math mode. Symbols such as subscripts ( _ ), integrals ( \\int ), Greek letters ( \\alpha, \\beta, \\delta ), and modifiers (\\vec{x}, \\tilde{x} ) must be written in math mode. See the full list <a target=\"_blank\" href=\"https://www.sharelatex.com/learn/Errors/Missing_$_inserted \">here</a>.If you intended to use mathematics mode, then use $ \u2026 $ for 'inline math mode', $$ \u2026 $$ for 'display math mode' or alternatively \begin{math} \u2026 \end{math}.
		"""
	,
		regexToMatch: /(undefined )?[rR]eference(s)?.+(undefined)?/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/There_were_undefined_references"
		humanReadableHint: """
			You have referenced something which has not yet been labelled. If you have labelled it already, make sure that what is written inside \\ref{...} is the same as what is written inside \\label{...}.
		"""
	,
		regexToMatch: /Citation .+ on page .+ undefined on input line .+/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/Citation_XXX_on_page_XXX_undefined_on_input_line_XXX"
		humanReadableHint: """
			You have cited something which is not included in your bibliography. Make sure that the citation (\\cite{...}) has a corresponding key in your bibliography, and that both are spelled the same way.
		"""
	,
		regexToMatch: /(Label .+)? multiply[ -]defined( labels)?/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/There_were_multiply-defined_labels"
		humanReadableHint: """
			You have used the same label more than once. Check that each \\label{...} labels only one item.
		"""
	,
		regexToMatch: /`!?h' float specifier changed to `!?ht'/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/%60!h%27_float_specifier_changed_to_%60!ht%27"
		humanReadableHint: """
			The float specifier 'h' is too strict of a demand for LaTeX to place your float in a nice way here. Try relaxing it by using 'ht', or even 'htbp' if necessary. If you want to try keep the float here anyway, check out the <a target=\"_blank\" href=\"https://www.sharelatex.com/learn/Positioning_of_Figures\">float package</a>.
		"""
	,
		regexToMatch: /No positions in optional float specifier/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/No_positions_in_optional_float_specifier"
		humanReadableHint: """
			You have forgotten to include a float specifier, which tells LaTeX where to position your figure. To fix this, either insert a float specifier inside the square brackets (e.g. \begin{figure}[h]), or remove the square brackets (e.g. \begin{figure}). Find out more about float specifiers <a target=\"_blank\" href=\"https://www.sharelatex.com/learn/Positioning_of_Figures\">here</a>.
		"""
	,
		regexToMatch: /Undefined control sequence/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/Undefined_control_sequence"
		humanReadableHint: """
			The compiler is having trouble understanding a command you have used. Check that the command is spelled correctly. If the command is part of a package, make sure you have included the package in your preamble using \\usepackage{...}.
		"""
	,
		regexToMatch: /File .+ not found/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/File_XXX_not_found_on_input_line_XXX"
		humanReadableHint: """
			The compiler cannot find the file you want to include. Make sure that you have <a target=\"_blank\" href=\"https://www.sharelatex.com/learn/Including_images_in_ShareLaTeX\">uploaded the file</a> and <a target=\"_blank\" href=\"https://www.sharelatex.com/learn/Errors/File_XXX_not_found_on_input_line_XXX.\">specified the file location correctly</a>.
		"""
	,
		regexToMatch: /LaTeX Error: Unknown graphics extension: \..+/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/LaTeX_Error:_Unknown_graphics_extension:_.XXX"
		humanReadableHint: """
			The compiler does not recognise the file type of one of your images. Make sure you are using a <a target=\"_blank\" href=\"https://www.sharelatex.com/learn/Errors/LaTeX_Error:_Unknown_graphics_extension:_.gif.\">supported image format</a> for your choice of compiler, and check that there are no periods (.) in the name of your image.
		"""
	,
		regexToMatch: /LaTeX Error: Unknown float option `H'/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/LaTeX_Error:_Unknown_float_option_%60H%27"
		humanReadableHint: """
			The compiler isn't recognizing the float option 'H'. Include \\usepackage{float} in your preamble to fix this.
		"""
	,
		regexToMatch: /LaTeX Error: Unknown float option `q'/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/LaTeX_Error:_Unknown_float_option_%60q%27"
		humanReadableHint: """
			You have used a float specifier which the compiler does not understand. You can learn more about the different float options available for placing figures <a target=\"_blank\" href=\"https://www.sharelatex.com/learn/Positioning_of_Figures\">here</a>.
		"""
	,
		regexToMatch: /LaTeX Error: \\math.+ allowed only in math mode/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/LaTeX_Error:_%5Cmathrm_allowed_only_in_math_mode"
		humanReadableHint: """
			You have used a font command which is only available in math mode. To use this command, you must be in maths mode (E.g. $ \u2026 $ or \\begin{math} \u2026 \\end{math}). If you want to use it outside of math mode, use the text version instead: \\textrm, \\textit, etc.
		"""
	,
		ruleId: "hint_mismatched_environment"
		regexToMatch: /Error: `([^']{2,})' expected, found `([^']{2,})'.*/
		newMessage: "Error: environment does not match \\begin{$1} ... \\end{$2}"
		humanReadableHint: """
			You have used \\begin{...} without a corresponding \\end{...}.
		"""
	,
		ruleId: "hint_mismatched_brackets"
		regexToMatch: /Error: `([^a-zA-Z0-9])' expected, found `([^a-zA-Z0-9])'.*/
		newMessage: "Error: brackets do not match, found '$2' instead of '$1'"
		humanReadableHint: """
			You have used an open bracket without a corresponding close bracket.
		"""
	,
		regexToMatch: /LaTeX Error: Can be used only in preamble/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/LaTeX_Error:_Can_be_used_only_in_preamble"
		humanReadableHint: """
			You have used a command in the main body of your document which should be used in the preamble. Make sure that \\documentclass[\u2026]{\u2026} and all \\usepackage{\u2026} commands are written before \\begin{document}.
		"""
	,
		regexToMatch: /Missing \\right inserted/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/Missing_%5Cright_insertede"
		humanReadableHint: """
			You have started an expression with a \\left command, but have not included a corresponding \\right command. Make sure that your \\left and \\right commands balance everywhere, or else try using \\Biggl and \\Biggr commands instead as shown <a target=\"_blank\" href=\"https://www.sharelatex.com/learn/Errors/Missing_%5Cright_inserted\">here</a>.
		"""
	,
		regexToMatch: /Double superscript/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/Double_superscript"
		humanReadableHint: """
			You have written a double superscript incorrectly as a^b^c, or else you have written a prime with a superscript. Remember to include { and } when using multiple superscripts. Try a^{b^c} instead.
		"""
	,
		regexToMatch: /Double subscript/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/Double_subscript"
		humanReadableHint: """
			You have written a double subscript incorrectly as a_b_c. Remember to include { and } when using multiple subscripts. Try a_{b_c} instead.
		"""
	,
		regexToMatch: /No \\author given/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/No_%5Cauthor_given"
		humanReadableHint: """
			You have used the \\maketitle command, but have not specified any \\author. To fix this, include an author in your preamble using the \\author{\u2026} command.
		"""
	,
		regexToMatch: /LaTeX Error: Environment .+ undefined/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors%2FLaTeX%20Error%3A%20Environment%20XXX%20undefined"
		humanReadableHint: """
			You have created an environment (using \\begin{\u2026} and \\end{\u2026} commands) which is not recognized. Make sure you have included the required package for that environment in your preamble, and that the environment is spelled correctly.
		"""
	,
		regexToMatch: /LaTeX Error: Something's wrong--perhaps a missing \\item/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/LaTeX_Error:_Something%27s_wrong--perhaps_a_missing_%5Citem"
		humanReadableHint: """
			There are no entries found in a list you have created. Make sure you label list entries using the \\item command, and that you have not used a list inside a table.
		"""
	,
		regexToMatch: /Misplaced \\noalign/
		extraInfoURL: "https://www.sharelatex.com/learn/Errors/Misplaced_%5Cnoalign"
		humanReadableHint: """
			You have used a \\hline command in the wrong place, probably outside a table. If the \\hline command is written inside a table, try including \\\ before it.
		"""
]
