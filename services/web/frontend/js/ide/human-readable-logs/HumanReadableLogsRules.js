/* eslint-disable no-useless-escape */
import packageSuggestions from './HumanReadableLogsPackageSuggestions'

const rules = [
  {
    ruleId: 'hint_misplaced_alignment_tab_character',
    regexToMatch: /Misplaced alignment tab character \&/,
  },
  {
    ruleId: 'hint_extra_alignment_tab_has_been_changed',
    regexToMatch: /Extra alignment tab has been changed to \\cr/,
  },
  {
    ruleId: 'hint_display_math_should_end_with',
    regexToMatch: /Display math should end with \$\$/,
  },
  {
    ruleId: 'hint_missing_inserted',
    regexToMatch: /Missing [{$] inserted./,
  },
  {
    ruleId: 'hint_reference_undefined',
    regexToMatch: /Reference.+undefined/,
  },
  {
    ruleId: 'hint_there_were_undefined_references',
    regexToMatch: /There were undefined references/,
  },
  {
    ruleId: 'hint_citation_on_page_undefined_on_input_line',
    regexToMatch: /Citation .+ on page .+ undefined on input line .+/,
  },
  {
    ruleId: 'hint_label_multiply_defined_labels',
    regexToMatch: /(Label .+)? multiply[ -]defined( labels)?/,
  },
  {
    ruleId: 'hint_float_specifier_changed',
    regexToMatch: /`!?h' float specifier changed to `!?ht'/,
  },
  {
    ruleId: 'hint_no_positions_in_optional_float_specifier',
    regexToMatch: /No positions in optional float specifier/,
  },
  {
    ruleId: 'hint_undefined_control_sequence',
    regexToMatch: /Undefined control sequence/,
    contentRegex: /^l\.[0-9]+\s*(\\\S+)/,
    improvedTitle: (currentTitle, details) => {
      if (details?.length && packageSuggestions.has(details[0])) {
        const command = details[0]
        const suggestion = packageSuggestions.get(command)
        return `${suggestion.command} is missing.`
      }
      return currentTitle
    },
  },
  {
    ruleId: 'hint_file_not_found',
    regexToMatch: /File .+ not found/,
  },
  {
    ruleId: 'hint_unknown_graphics_extension',
    regexToMatch: /LaTeX Error: Unknown graphics extension: \..+/,
  },
  {
    ruleId: 'hint_unknown_float_option_h',
    regexToMatch: /LaTeX Error: Unknown float option `H'/,
  },
  {
    ruleId: 'hint_unknown_float_option_q',
    regexToMatch: /LaTeX Error: Unknown float option `q'/,
  },
  {
    ruleId: 'hint_math_allowed_only_in_math_mode',
    regexToMatch: /LaTeX Error: \\math.+ allowed only in math mode/,
  },
  {
    ruleId: 'hint_mismatched_environment',
    types: ['environment'],
    regexToMatch: /Error: `([^']{2,})' expected, found `([^']{2,})'.*/,
    newMessage: 'Error: environment does not match \\begin{$1} ... \\end{$2}',
  },
  {
    ruleId: 'hint_mismatched_brackets',
    types: ['environment'],
    regexToMatch: /Error: `([^a-zA-Z0-9])' expected, found `([^a-zA-Z0-9])'.*/,
    newMessage: "Error: brackets do not match, found '$2' instead of '$1'",
  },
  {
    ruleId: 'hint_can_be_used_only_in_preamble',
    regexToMatch: /LaTeX Error: Can be used only in preamble/,
  },
  {
    ruleId: 'hint_missing_right_inserted',
    regexToMatch: /Missing \\right inserted/,
  },
  {
    ruleId: 'hint_double_superscript',
    regexToMatch: /Double superscript/,
  },
  {
    ruleId: 'hint_double_subscript',
    regexToMatch: /Double subscript/,
  },
  {
    ruleId: 'hint_no_author_given',
    regexToMatch: /No \\author given/,
  },
  {
    ruleId: 'hint_environment_undefined',
    regexToMatch: /LaTeX Error: Environment .+ undefined/,
  },
  {
    ruleId: 'hint_somethings_wrong_perhaps_a_missing_item',
    regexToMatch: /LaTeX Error: Something's wrong--perhaps a missing \\item/,
  },
  {
    ruleId: 'hint_misplaced_noalign',
    regexToMatch: /Misplaced \\noalign/,
  },
  {
    ruleId: 'hint_no_line_here_to_end',
    regexToMatch: /LaTeX Error: There's no line here to end/,
  },
  {
    ruleId: 'hint_verb_ended_by_end_of_line',
    regexToMatch: /LaTeX Error: \\verb ended by end of line/,
  },
  {
    ruleId: 'hint_illegal_unit_of_measure_pt_inserted',
    regexToMatch: /Illegal unit of measure (pt inserted)/,
  },
  {
    ruleId: 'hint_extra_right',
    regexToMatch: /Extra \\right/,
  },
  {
    ruleId: 'hint_missing_begin_document_',
    regexToMatch: /Missing \\begin{document}/,
  },
  {
    ruleId: 'hint_mismatched_environment2',
    types: ['environment'],
    cascadesFrom: ['environment'],
    regexToMatch:
      /Error: `\\end\{([^\}]+)\}' expected but found `\\end\{([^\}]+)\}'.*/,
    newMessage: 'Error: environments do not match: \\begin{$1} ... \\end{$2}',
  },
  {
    ruleId: 'hint_mismatched_environment3',
    types: ['environment'],
    cascadesFrom: ['environment'],
    regexToMatch:
      /Warning: No matching \\end found for `\\begin\{([^\}]+)\}'.*/,
    newMessage: 'Warning: No matching \\end found for \\begin{$1}',
  },
  {
    ruleId: 'hint_mismatched_environment4',
    types: ['environment'],
    cascadesFrom: ['environment'],
    regexToMatch:
      /Error: Found `\\end\{([^\}]+)\}' without corresponding \\begin.*/,
    newMessage: 'Error: found \\end{$1} without a corresponding \\begin{$1}',
  },
]

export default rules
