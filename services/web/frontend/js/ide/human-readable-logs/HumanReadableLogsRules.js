/* eslint-disable no-useless-escape */
import React from 'react'
import PropTypes from 'prop-types'

function WikiLink({ url, children }) {
  return window.wikiEnabled ? (
    <a href={url} target="_blank">
      {children}
    </a>
  ) : (
    <>{children}</>
  )
}

WikiLink.propTypes = {
  url: PropTypes.string,
  children: PropTypes.node.isRequired,
}

const rules = [
  {
    regexToMatch: /Misplaced alignment tab character \&/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/Misplaced_alignment_tab_character_%26',
    humanReadableHintComponent: (
      <>
        You have placed an alignment tab character '&' in the wrong place. If
        you want to align something, you must write it inside an align
        environment such as \begin
        {'{align}'} … \end
        {'{align}'}, \begin
        {'{tabular}'} … \end
        {'{tabular}'}, etc. If you want to write an ampersand '&' in text, you
        must write \& instead.
      </>
    ),
    humanReadableHint:
      'You have placed an alignment tab character &#x27;&amp;&#x27; in the wrong place. If you want to align something, you must write it inside an align environment such as \\begin{align} … \\end{align}, \\begin{tabular} … \\end{tabular}, etc. If you want to write an ampersand &#x27;&amp;&#x27; in text, you must write \\&amp; instead.',
  },
  {
    regexToMatch: /Extra alignment tab has been changed to \\cr/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/Extra_alignment_tab_has_been_changed_to_%5Ccr',
    humanReadableHintComponent: (
      <>
        You have written too many alignment tabs in a table, causing one of them
        to be turned into a line break. Make sure you have specified the correct
        number of columns in your{' '}
        <WikiLink url="https://www.overleaf.com/learn/Tables">table</WikiLink>.
      </>
    ),
    humanReadableHint:
      'You have written too many alignment tabs in a table, causing one of them to be turned into a line break. Make sure you have specified the correct number of columns in your <a href="https://www.overleaf.com/learn/Tables" target="_blank">table</a>.',
  },
  {
    regexToMatch: /Display math should end with \$\$/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/Display_math_should_end_with_$$',
    humanReadableHintComponent: (
      <>
        You have forgotten a $ sign at the end of 'display math' mode. When
        writing in display math mode, you must always math write inside $$ … $$.
        Check that the number of $s match around each math expression.
      </>
    ),
    humanReadableHint:
      'You have forgotten a $ sign at the end of &#x27;display math&#x27; mode. When writing in display math mode, you must always math write inside $$ … $$. Check that the number of $s match around each math expression.',
  },
  {
    regexToMatch: /Missing [{$] inserted./,
    extraInfoURL: 'https://www.overleaf.com/learn/Errors/Missing_$_inserted',
    humanReadableHintComponent: (
      <>
        Check that your $'s match around math expressions. If they do, then
        you've probably used a symbol in normal text that needs to be in math
        mode. Symbols such as subscripts ( _ ), integrals ( \int ), Greek
        letters ( \alpha, \beta, \delta ), and modifiers (\vec
        {'{x}'}, \tilde
        {'{x}'} ) must be written in math mode. See the full list{' '}
        <WikiLink url="https://www.overleaf.com/learn/Errors/Missing_$_inserted">
          here
        </WikiLink>
        . If you intended to use mathematics mode, then use $ … $ for 'inline
        math mode', $$ … $$ for 'display math mode' or alternatively \begin
        {'{math}'} … \end
        {'{math}'}.
      </>
    ),
    humanReadableHint:
      'Check that your $&#x27;s match around math expressions. If they do, then you&#x27;ve probably used a symbol in normal text that needs to be in math mode. Symbols such as subscripts ( _ ), integrals ( \\int ), Greek letters ( \\alpha, \\beta, \\delta ), and modifiers (\\vec{x}, \\tilde{x} ) must be written in math mode. See the full list <a href="https://www.overleaf.com/learn/Errors/Missing_$_inserted" target="_blank">here</a>. If you intended to use mathematics mode, then use $ … $ for &#x27;inline math mode&#x27;, $$ … $$ for &#x27;display math mode&#x27; or alternatively \\begin{math} … \\end{math}.',
  },
  {
    regexToMatch: /(undefined )?[rR]eference(s)?.+(undefined)?/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/There_were_undefined_references',
    humanReadableHintComponent: (
      <>
        You have referenced something which has not yet been labelled. If you
        have labelled it already, make sure that what is written inside \ref
        {'{...}'} is the same as what is written inside \label
        {'{...}'}.
      </>
    ),
    humanReadableHint:
      'You have referenced something which has not yet been labelled. If you have labelled it already, make sure that what is written inside \\ref{...} is the same as what is written inside \\label{...}.',
  },
  {
    regexToMatch: /Citation .+ on page .+ undefined on input line .+/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/Citation_XXX_on_page_XXX_undefined_on_input_line_XXX',
    humanReadableHintComponent: (
      <>
        You have cited something which is not included in your bibliography.
        Make sure that the citation (\cite
        {'{...}'}) has a corresponding key in your bibliography, and that both
        are spelled the same way.
      </>
    ),
    humanReadableHint:
      'You have cited something which is not included in your bibliography. Make sure that the citation (\\cite{...}) has a corresponding key in your bibliography, and that both are spelled the same way.',
  },
  {
    regexToMatch: /(Label .+)? multiply[ -]defined( labels)?/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/There_were_multiply-defined_labels',
    humanReadableHintComponent: (
      <>
        You have used the same label more than once. Check that each \label
        {'{...}'} labels only one item.
      </>
    ),
    humanReadableHint:
      'You have used the same label more than once. Check that each \\label{...} labels only one item.',
  },
  {
    regexToMatch: /`!?h' float specifier changed to `!?ht'/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/%60!h%27_float_specifier_changed_to_%60!ht%27',
    humanReadableHintComponent: (
      <>
        The float specifier 'h' is too strict of a demand for LaTeX to place
        your float in a nice way here. Try relaxing it by using 'ht', or even
        'htbp' if necessary. If you want to try keep the float here anyway,
        check out the{' '}
        <WikiLink url="https://www.overleaf.com/learn/Positioning_of_Figures">
          float package
        </WikiLink>
        .
      </>
    ),
    humanReadableHint:
      'The float specifier &#x27;h&#x27; is too strict of a demand for LaTeX to place your float in a nice way here. Try relaxing it by using &#x27;ht&#x27;, or even &#x27;htbp&#x27; if necessary. If you want to try keep the float here anyway, check out the <a href="https://www.overleaf.com/learn/Positioning_of_Figures" target="_blank">float package</a>.',
  },
  {
    regexToMatch: /No positions in optional float specifier/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/No_positions_in_optional_float_specifier',
    humanReadableHintComponent: (
      <>
        You have forgotten to include a float specifier, which tells LaTeX where
        to position your figure. To fix this, either insert a float specifier
        inside the square brackets (e.g. \begin
        {'{figure}'}
        [h]), or remove the square brackets (e.g. \begin
        {'{figure}'}
        ). Find out more about float specifiers{' '}
        <WikiLink url="https://www.overleaf.com/learn/Positioning_of_Figures">
          here
        </WikiLink>
        .
      </>
    ),
    humanReadableHint:
      'You have forgotten to include a float specifier, which tells LaTeX where to position your figure. To fix this, either insert a float specifier inside the square brackets (e.g. \\begin{figure}[h]), or remove the square brackets (e.g. \\begin{figure}). Find out more about float specifiers <a href="https://www.overleaf.com/learn/Positioning_of_Figures" target="_blank">here</a>.',
  },
  {
    regexToMatch: /Undefined control sequence/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/Undefined_control_sequence',
    humanReadableHintComponent: (
      <>
        The compiler is having trouble understanding a command you have used.
        Check that the command is spelled correctly. If the command is part of a
        package, make sure you have included the package in your preamble using
        \usepackage
        {'{...}'}.
      </>
    ),
    humanReadableHint:
      'The compiler is having trouble understanding a command you have used. Check that the command is spelled correctly. If the command is part of a package, make sure you have included the package in your preamble using \\usepackage{...}.',
  },
  {
    regexToMatch: /File .+ not found/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/File_XXX_not_found_on_input_line_XXX',
    humanReadableHintComponent: (
      <>
        The compiler cannot find the file you want to include. Make sure that
        you have{' '}
        <WikiLink url="https://www.overleaf.com/learn/Including_images_in_ShareLaTeX">
          uploaded the file
        </WikiLink>{' '}
        and{' '}
        <WikiLink url="https://www.overleaf.com/learn/Errors/File_XXX_not_found_on_input_line_XXX.">
          specified the file location correctly
        </WikiLink>
        .
      </>
    ),
    humanReadableHint:
      'The compiler cannot find the file you want to include. Make sure that you have <a href="https://www.overleaf.com/learn/Including_images_in_ShareLaTeX" target="_blank">uploaded the file</a> and <a href="https://www.overleaf.com/learn/Errors/File_XXX_not_found_on_input_line_XXX." target="_blank">specified the file location correctly</a>.',
  },
  {
    regexToMatch: /LaTeX Error: Unknown graphics extension: \..+/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/LaTeX_Error:_Unknown_graphics_extension:_.XXX',
    humanReadableHintComponent: (
      <>
        The compiler does not recognise the file type of one of your images.
        Make sure you are using a{' '}
        <WikiLink url="https://www.overleaf.com/learn/Errors/LaTeX_Error:_Unknown_graphics_extension:_.gif.">
          supported image format
        </WikiLink>{' '}
        for your choice of compiler, and check that there are no periods (.) in
        the name of your image.
      </>
    ),
    humanReadableHint:
      'The compiler does not recognise the file type of one of your images. Make sure you are using a <a href="https://www.overleaf.com/learn/Errors/LaTeX_Error:_Unknown_graphics_extension:_.gif." target="_blank">supported image format</a> for your choice of compiler, and check that there are no periods (.) in the name of your image.',
  },
  {
    regexToMatch: /LaTeX Error: Unknown float option `H'/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/LaTeX_Error:_Unknown_float_option_%60H%27',
    humanReadableHintComponent: (
      <>
        The compiler isn't recognizing the float option 'H'. Include \usepackage
        {'{float}'} in your preamble to fix this.
      </>
    ),
    humanReadableHint:
      'The compiler isn&#x27;t recognizing the float option &#x27;H&#x27;. Include \\usepackage{float} in your preamble to fix this.',
  },
  {
    regexToMatch: /LaTeX Error: Unknown float option `q'/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/LaTeX_Error:_Unknown_float_option_%60q%27',
    humanReadableHintComponent: (
      <>
        You have used a float specifier which the compiler does not understand.
        You can learn more about the different float options available for
        placing figures{' '}
        <WikiLink url="https://www.overleaf.com/learn/Positioning_of_Figures">
          here
        </WikiLink>{' '}
        .
      </>
    ),
    humanReadableHint:
      'You have used a float specifier which the compiler does not understand. You can learn more about the different float options available for placing figures <a href="https://www.overleaf.com/learn/Positioning_of_Figures" target="_blank">here</a> .',
  },
  {
    regexToMatch: /LaTeX Error: \\math.+ allowed only in math mode/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/LaTeX_Error:_%5Cmathrm_allowed_only_in_math_mode',
    humanReadableHintComponent: (
      <>
        You have used a font command which is only available in math mode. To
        use this command, you must be in maths mode (E.g. $ … $ or \begin
        {'{math}'} … \end
        {'{math}'}
        ). If you want to use it outside of math mode, use the text version
        instead: \textrm, \textit, etc.
      </>
    ),
    humanReadableHint:
      'You have used a font command which is only available in math mode. To use this command, you must be in maths mode (E.g. $ … $ or \\begin{math} … \\end{math}). If you want to use it outside of math mode, use the text version instead: \\textrm, \\textit, etc.',
  },
  {
    ruleId: 'hint_mismatched_environment',
    types: ['environment'],
    regexToMatch: /Error: `([^']{2,})' expected, found `([^']{2,})'.*/,
    newMessage: 'Error: environment does not match \\begin{$1} ... \\end{$2}',
    humanReadableHintComponent: (
      <>
        You have used \begin
        {'{...}'} without a corresponding \end
        {'{...}'}.
      </>
    ),
    humanReadableHint:
      'You have used \\begin{...} without a corresponding \\end{...}.',
  },
  {
    ruleId: 'hint_mismatched_brackets',
    types: ['environment'],
    regexToMatch: /Error: `([^a-zA-Z0-9])' expected, found `([^a-zA-Z0-9])'.*/,
    newMessage: "Error: brackets do not match, found '$2' instead of '$1'",
    humanReadableHintComponent: (
      <>You have used an open bracket without a corresponding close bracket.</>
    ),
    humanReadableHint:
      'You have used an open bracket without a corresponding close bracket.',
  },
  {
    regexToMatch: /LaTeX Error: Can be used only in preamble/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/LaTeX_Error:_Can_be_used_only_in_preamble',
    humanReadableHintComponent: (
      <>
        You have used a command in the main body of your document which should
        be used in the preamble. Make sure that \documentclass[…]
        {'{…}'} and all \usepackage
        {'{…}'} commands are written before \begin
        {'{document}'}.
      </>
    ),
    humanReadableHint:
      'You have used a command in the main body of your document which should be used in the preamble. Make sure that \\documentclass[…]{…} and all \\usepackage{…} commands are written before \\begin{document}.',
  },
  {
    regexToMatch: /Missing \\right inserted/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/Missing_%5Cright_insertede',
    humanReadableHintComponent: (
      <>
        You have started an expression with a \left command, but have not
        included a corresponding \right command. Make sure that your \left and
        \right commands balance everywhere, or else try using \Biggl and \Biggr
        commands instead as shown{' '}
        <WikiLink url="https://www.overleaf.com/learn/Errors/Missing_%5Cright_inserted">
          here
        </WikiLink>
        .
      </>
    ),
    humanReadableHint:
      'You have started an expression with a \\left command, but have not included a corresponding \\right command. Make sure that your \\left and \\right commands balance everywhere, or else try using \\Biggl and \\Biggr commands instead as shown <a href="https://www.overleaf.com/learn/Errors/Missing_%5Cright_inserted" target="_blank">here</a>.',
  },
  {
    regexToMatch: /Double superscript/,
    extraInfoURL: 'https://www.overleaf.com/learn/Errors/Double_superscript',
    humanReadableHintComponent: (
      <>
        You have written a double superscript incorrectly as a^b^c, or else you
        have written a prime with a superscript. Remember to include {'{and}'}{' '}
        when using multiple superscripts. Try a^
        {'{b ^ c}'} instead.
      </>
    ),
    humanReadableHint:
      'You have written a double superscript incorrectly as a^b^c, or else you have written a prime with a superscript. Remember to include {and} when using multiple superscripts. Try a^{b ^ c} instead.',
  },
  {
    regexToMatch: /Double subscript/,
    extraInfoURL: 'https://www.overleaf.com/learn/Errors/Double_subscript',
    humanReadableHintComponent: (
      <>
        You have written a double subscript incorrectly as a_b_c. Remember to
        include {'{and}'} when using multiple subscripts. Try a_
        {'{b_c}'} instead.
      </>
    ),
    humanReadableHint:
      'You have written a double subscript incorrectly as a_b_c. Remember to include {and} when using multiple subscripts. Try a_{b_c} instead.',
  },
  {
    regexToMatch: /No \\author given/,
    extraInfoURL: 'https://www.overleaf.com/learn/Errors/No_%5Cauthor_given',
    humanReadableHintComponent: (
      <>
        You have used the \maketitle command, but have not specified any
        \author. To fix this, include an author in your preamble using the
        \author
        {'{…}'} command.
      </>
    ),
    humanReadableHint:
      'You have used the \\maketitle command, but have not specified any \\author. To fix this, include an author in your preamble using the \\author{…} command.',
  },
  {
    regexToMatch: /LaTeX Error: Environment .+ undefined/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors%2FLaTeX%20Error%3A%20Environment%20XXX%20undefined',
    humanReadableHintComponent: (
      <>
        You have created an environment (using \begin
        {'{…}'} and \end
        {'{…}'} commands) which is not recognized. Make sure you have included
        the required package for that environment in your preamble, and that the
        environment is spelled correctly.
      </>
    ),
    humanReadableHint:
      'You have created an environment (using \\begin{…} and \\end{…} commands) which is not recognized. Make sure you have included the required package for that environment in your preamble, and that the environment is spelled correctly.',
  },
  {
    regexToMatch: /LaTeX Error: Something's wrong--perhaps a missing \\item/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/LaTeX_Error:_Something%27s_wrong--perhaps_a_missing_%5Citem',
    humanReadableHintComponent: (
      <>
        There are no entries found in a list you have created. Make sure you
        label list entries using the \item command, and that you have not used a
        list inside a table.
      </>
    ),
    humanReadableHint:
      'There are no entries found in a list you have created. Make sure you label list entries using the \\item command, and that you have not used a list inside a table.',
  },
  {
    regexToMatch: /Misplaced \\noalign/,
    extraInfoURL: 'https://www.overleaf.com/learn/Errors/Misplaced_%5Cnoalign',
    humanReadableHintComponent: (
      <>
        You have used a \hline command in the wrong place, probably outside a
        table. If the \hline command is written inside a table, try including \\
        before it.
      </>
    ),
    humanReadableHint:
      'You have used a \\hline command in the wrong place, probably outside a table. If the \\hline command is written inside a table, try including \\\\ before it.',
  },
  {
    regexToMatch: /LaTeX Error: There's no line here to end/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/LaTeX_Error:_There%27s_no_line_here_to_end',
    humanReadableHintComponent: (
      <>
        You have used a \\ or \newline command where LaTeX was not expecting
        one. Make sure that you only use line breaks after blocks of text, and
        be careful using linebreaks inside lists and other environments.\
      </>
    ),
    humanReadableHint:
      'You have used a \\\\ or \\newline command where LaTeX was not expecting one. Make sure that you only use line breaks after blocks of text, and be careful using linebreaks inside lists and other environments.\\',
  },
  {
    regexToMatch: /LaTeX Error: \\verb ended by end of line/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors/LaTeX_Error:_%5Cverb_ended_by_end_of_line',
    humanReadableHintComponent: (
      <>
        You have used a \verb command incorrectly. Try replacling the \verb
        command with \begin
        {'{verbatim}'}
        …\end
        {'{verbatim}'}
        .\
      </>
    ),
    humanReadableHint:
      'You have used a \\verb command incorrectly. Try replacling the \\verb command with \\begin{verbatim}…\\end{verbatim}.\\',
  },
  {
    regexToMatch: /Illegal unit of measure (pt inserted)/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors%2FIllegal%20unit%20of%20measure%20(pt%20inserted)',
    humanReadableHintComponent: (
      <>
        You have written a length, but have not specified the appropriate units
        (pt, mm, cm etc.). If you have not written a length, check that you have
        not witten a linebreak \\ followed by square brackets […] anywhere.
      </>
    ),
    humanReadableHint:
      'You have written a length, but have not specified the appropriate units (pt, mm, cm etc.). If you have not written a length, check that you have not witten a linebreak \\\\ followed by square brackets […] anywhere.',
  },
  {
    regexToMatch: /Extra \\right/,
    extraInfoURL: 'https://www.overleaf.com/learn/Errors/Extra_%5Cright',
    humanReadableHintComponent: (
      <>
        You have written a \right command without a corresponding \left command.
        Check that all \left and \right commands balance everywhere.
      </>
    ),
    humanReadableHint:
      'You have written a \\right command without a corresponding \\left command. Check that all \\left and \\right commands balance everywhere.',
  },
  {
    regexToMatch: /Missing \\begin{document}/,
    extraInfoURL:
      'https://www.overleaf.com/learn/Errors%2FLaTeX%20Error%3A%20Missing%20%5Cbegin%20document',
    humanReadableHintComponent: (
      <>
        No \begin
        {'{document}'} command was found. Make sure you have included \begin
        {'{document}'} in your preamble, and that your main document is set
        correctly.
      </>
    ),
    humanReadableHint:
      'No \\begin{document} command was found. Make sure you have included \\begin{document} in your preamble, and that your main document is set correctly.',
  },
  {
    ruleId: 'hint_mismatched_environment2',
    types: ['environment'],
    cascadesFrom: ['environment'],
    regexToMatch: /Error: `\\end\{([^\}]+)\}' expected but found `\\end\{([^\}]+)\}'.*/,
    newMessage: 'Error: environments do not match: \\begin{$1} ... \\end{$2}',
    humanReadableHintComponent: (
      <>
        You have used \begin
        {'{}'} without a corresponding \end
        {'{}'}.
      </>
    ),
    humanReadableHint:
      'You have used \\begin{} without a corresponding \\end{}.',
  },
  {
    ruleId: 'hint_mismatched_environment3',
    types: ['environment'],
    cascadesFrom: ['environment'],
    regexToMatch: /Warning: No matching \\end found for `\\begin\{([^\}]+)\}'.*/,
    newMessage: 'Warning: No matching \\end found for \\begin{$1}',
    humanReadableHintComponent: (
      <>
        You have used \begin
        {'{}'} without a corresponding \end
        {'{}'}.
      </>
    ),
    humanReadableHint:
      'You have used \\begin{} without a corresponding \\end{}.',
  },
  {
    ruleId: 'hint_mismatched_environment4',
    types: ['environment'],
    cascadesFrom: ['environment'],
    regexToMatch: /Error: Found `\\end\{([^\}]+)\}' without corresponding \\begin.*/,
    newMessage: 'Error: found \\end{$1} without a corresponding \\begin{$1}',
    humanReadableHintComponent: (
      <>
        You have used \begin
        {'{}'} without a corresponding \end
        {'{}'}.
      </>
    ),
    humanReadableHint:
      'You have used \\begin{} without a corresponding \\end{}.',
  },
]

if (!window.wikiEnabled) {
  rules.forEach(rule => {
    rule.extraInfoURL = null
    rule.humanReadableHint = stripHTMLFromString(rule.humanReadableHint)
  })
}

function stripHTMLFromString(htmlStr) {
  const tmp = document.createElement('DIV')
  tmp.innerHTML = htmlStr
  return tmp.textContent || tmp.innerText || ''
}

export default rules
