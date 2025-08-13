/* eslint-disable no-useless-escape */
import {
  packageSuggestionsForCommands,
  packageSuggestionsForEnvironments,
} from './HumanReadableLogsPackageSuggestions'

interface Rule {
  ruleId: string
  types?: string[]
  cascadesFrom?: string[]
  newMessage?: string
  regexToMatch: RegExp
  contentRegex?: RegExp
  improvedTitle?: (
    currentTitle: string,
    details?: string[]
  ) => string | [string, JSX.Element]
  package?: string
  highlightCommand?: (contentDetails: string[]) => string | undefined
}

const rules: Rule[] = [
  {
    ruleId: 'hint_misplaced_alignment_tab_character',
    regexToMatch: /Misplaced alignment tab character &/,
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
    regexToMatch: /Missing [{$] inserted\./,
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
    regexToMatch: /`!?h' float specifier changed to `!?ht/,
  },
  {
    ruleId: 'hint_no_positions_in_optional_float_specifier',
    regexToMatch: /No positions in optional float specifier/,
  },
  {
    ruleId: 'hint_undefined_control_sequence',
    regexToMatch: /Undefined control sequence/,
    // Match the last control sequence in the line
    contentRegex: /^[^\n]*(\\\S+)\s*[\n]/,
    improvedTitle: (currentTitle: string, details?: string[]) => {
      if (!details?.length) {
        return currentTitle
      }
      const command = details[0]
      const suggestion = packageSuggestionsForCommands.get(command)
      if (suggestion) {
        return [
          `Is ${suggestion.command} missing?`,
          // eslint-disable-next-line react/jsx-key
          <span>
            Is <code>{suggestion.command}</code> missing?
          </span>,
        ]
      }
      return currentTitle
    },
    highlightCommand(contentDetails) {
      return contentDetails[0]
    },
  },
  {
    ruleId: 'hint_undefined_environment',
    regexToMatch: /LaTeX Error: Environment .+ undefined/,
    contentRegex: /\\begin\{(\S+)\}/,
    improvedTitle: (currentTitle: string, details?: string[]) => {
      if (!details?.length) {
        return currentTitle
      }
      const environment = details[0]
      const suggestion = packageSuggestionsForEnvironments.get(environment)
      if (suggestion) {
        return [
          `Is ${suggestion.command} missing?`,
          // eslint-disable-next-line react/jsx-key
          <span>
            Is <code>{suggestion.command}</code> missing?
          </span>,
        ]
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
    regexToMatch: /LaTeX Error: Unknown float option `H/,
  },
  {
    ruleId: 'hint_unknown_float_option_q',
    regexToMatch: /LaTeX Error: Unknown float option `q/,
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
    ruleId: 'hint_missing_begin_document',
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

const errors: Rule[] = [
  {
    ruleId: 'hint_character_invalid_at_this_point',
    regexToMatch: /^Package calc error: `(.+?)' invalid at this point/,
    package: 'calc',
  },
  {
    ruleId: 'hint_command_allowed_only_in_math_mode',
    regexToMatch: /^Package amsmath error: (.+?) allowed only in math mode/,
    package: 'amsmath',
  },
  {
    ruleId: 'hint_command_undefined',
    regexToMatch: /^LaTeX error: (.+?) undefined/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_lt_in_mid_line',
    regexToMatch: /^LaTeX error: \\< in mid line/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_a_box_was_supposed_to_be_here',
    regexToMatch: /^A <Box> was supposed to be here/i, // note: can be <box>
    package: 'TeX',
  },
  {
    ruleId: 'hint_accent_not_provided_by_font_family',
    regexToMatch:
      /^Package textcomp error: Accent (.+?) not provided by font family (.+)/,
    package: 'textcomp',
  },
  {
    ruleId: 'hint_argument_of_has_an_extra',
    regexToMatch: /^Argument of (.+?) has an extra }/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_bad_line_or_vector_argument',
    regexToMatch: /^LaTeX error: Bad \\line or \\vector argument/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_bad_math_environment_delimiter',
    regexToMatch: /^LaTeX error: Bad math environment delimiter/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_begin_env_allowed_only_in_paragraph_mode',
    regexToMatch:
      /^Package amsmath error: \\begin{(.+?)} allowed only in paragraph mode/,
    package: 'amsmath',
  },
  {
    ruleId: 'hint_begin_env_on_input_line_x_ended_by_end_x',
    regexToMatch:
      /^LaTeX error: \\begin{(.+?)} on input line (.+?) ended by \\end{(.+?)}/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_begin_split_wont_work_here',
    regexToMatch: /^Package amsmath error: \\begin{split} won't work here/,
    package: 'amsmath',
  },
  {
    ruleId: 'hint_can_be_used_only_in_preamble',
    regexToMatch: /^LaTeX error: Can be used only in preamble/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_cannot_be_used_in_preamble',
    regexToMatch: /^LaTeX error: Cannot be used in preamble/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_unicode_character',
    regexToMatch: /^LaTeX Error: Unicode character /,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_cannot_define_unicode_char_value_lt_00a0',
    regexToMatch:
      /^Package inputenc error: Cannot define Unicode char value < 00A0/,
    package: 'inputenc',
  },
  {
    ruleId: 'hint_cannot_determine_size_of_graphic_in_file',
    regexToMatch:
      /^Package (graphics|graphicx) error: Cannot determine size of graphic in (.+)/,
    package: 'graphics/graphicx',
  },
  {
    ruleId: 'hint_cannot_include_graphics_of_type',
    regexToMatch:
      /^Package (graphics|graphicx) error: Cannot include graphics of type\s*: (.+)/,
    package: 'graphics/graphicx',
  },
  {
    ruleId: 'hint_caption_outside_float',
    regexToMatch: /^LaTeX error: \\caption outside float/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_command_already_defined',
    regexToMatch: /^LaTeX error: Command (.+?) already defined/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_command_invalid_in_math_mode',
    regexToMatch: /^LaTeX error: Command (.+?) invalid in math mode/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_command_not_defined_as_a_math_alphabet',
    regexToMatch: /^LaTeX error: Command (.+?) not defined as a math alphabet/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_corrupted_nfss_tables',
    regexToMatch: /^LaTeX error: Corrupted NFSS tables/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_counter_too_large',
    regexToMatch: /^LaTeX error: Counter too large/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_dimension_too_large',
    regexToMatch: /^Dimension too large/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_displaybreak_cannot_be_applied_here',
    regexToMatch:
      /^Package amsmath error: \\displaybreak cannot be applied here/,
    package: 'amsmath',
  },
  {
    ruleId: 'hint_division_by_0',
    regexToMatch: /^Package (graphics|graphicx) error: Division by 0/,
    package: 'graphics/graphicx',
  },
  {
    ruleId: 'hint_double_subscript',
    regexToMatch: /^Double subscript/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_double_superscript',
    regexToMatch: /^Double superscript/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_encoding_file_not_found',
    regexToMatch: /^Package fontenc error: Encoding file `(.+?)' not found/,
    package: 'fontenc',
  },
  {
    ruleId: 'hint_encoding_scheme_unknown',
    regexToMatch: /^LaTeX error: Encoding scheme `(.+?)' unknown/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_environment_undefined',
    regexToMatch: /^LaTeX error: Environment (.+?) undefined/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_erroneous_nesting_of_equation_structures',
    regexToMatch:
      /^Package amsmath error: Erroneous nesting of equation structures/,
    package: 'amsmath',
  },
  {
    ruleId: 'hint_extra_on_this_line',
    regexToMatch: /^Package amsmath error: Extra & on this line/,
    package: 'amsmath',
  },
  {
    ruleId: 'hint_extra_alignment_tab_has_been_changed_to_cr',
    regexToMatch: /^Extra alignment tab has been changed to \\cr/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_extra_endgroup',
    regexToMatch: /^Extra \\endgroup/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_extra_or',
    regexToMatch: /^Extra \\or/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_extra_right',
    regexToMatch: /^Extra \\right/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_extra_or_forgotten',
    regexToMatch: /^Extra }, or forgotten \$/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_extra_or_forgotten_endgroup',
    regexToMatch: /^Extra }, or forgotten \\endgroup/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_file_not_found',
    regexToMatch: /^LaTeX error: File `(.+?)' not found/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_file_ended_while_scanning',
    regexToMatch: /^File ended while scanning (.+)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_float_lost',
    regexToMatch: /^LaTeX error: Float\(s\) lost/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_font_family_unknown',
    regexToMatch: /^LaTeX error: Font family `(.+?)\+(.+?)' unknown/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_font_not_found',
    regexToMatch: /^LaTeX error: Font (.+?) not found/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_font_not_loaded_not_enough_room_left',
    regexToMatch: /^Font (.+?)=(.+?) not loaded: Not enough room left/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_font_shape_not_found',
    regexToMatch: /^LaTeX error: Font shape (.+?) not found/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_i_cant_find_file',
    regexToMatch: /^I can't find file `(.+?)'/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_i_cant_write_on_file',
    regexToMatch: /^I can't write on file `(.+?)'/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_illegal_character_in_array_arg',
    regexToMatch: /^LaTeX error: Illegal character in array arg/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_illegal_parameter_number_in_definition_of',
    regexToMatch: /^Illegal parameter number in definition of (.+)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_illegal_unit_of_measure_pt_inserted',
    regexToMatch: /^Illegal unit of measure \(pt inserted\)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_improper_argument_for_math_accent',
    regexToMatch: /^Package amsmath error: Improper argument for math accent/,
    package: 'amsmath',
  },
  {
    ruleId: 'hint_improper_discretionary_list',
    regexToMatch: /^Improper discretionary list/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_improper_hyphenation',
    regexToMatch: /^Improper \\hyphenation/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_improper_prevdepth',
    regexToMatch: /^Improper \\prevdepth/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_improper_spacefactor',
    regexToMatch: /^Improper \\spacefactor/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_include_cannot_be_nested',
    regexToMatch: /^LaTeX error: \\include cannot be nested/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_incompatible_list_cant_be_unboxed',
    regexToMatch: /^Incompatible list can't be unboxed/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_incomplete_all_text_was_ignored_after_line',
    regexToMatch: /^Incomplete (.+?); all text was ignored after line (.+)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_infinite_glue_shrinkage_found',
    regexToMatch: /^Infinite glue shrinkage found (.+)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_interruption',
    regexToMatch: /^Interruption/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_invalid_use_of_commande',
    regexToMatch: /^Package amsmath error: Invalid use of (.+)/,
    package: 'amsmath',
  },
  {
    ruleId: 'hint_keyboard_character_used_is_undefined_in_input_encoding',
    regexToMatch:
      /^Package inputenc error: Keyboard character used is undefined in input encoding (.+)/,
    package: 'inputenc',
  },
  {
    ruleId: 'hint_language_definition_file_not_found',
    regexToMatch:
      /^Package babel error: Language definition file (.+?)\.ldf not found /,
    package: 'babel',
  },
  {
    ruleId: 'hint_limit_controls_must_follow_a_math_operator',
    regexToMatch: /^Limit controls must follow a math operator/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_loadclass_in_package_file',
    regexToMatch: /^LaTeX error: \\LoadClass in package file/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_lonely_item_perhaps_a_missing_list_environment',
    regexToMatch:
      /^LaTeX error: Lonely \\item--perhaps a missing list environment/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_math_alphabet_identifier_is_undefined_in_math_version',
    regexToMatch:
      /^LaTeX error: Math alphabet identifier (.+?) is undefined in math version (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_math_version_is_not_defined',
    regexToMatch: /^LaTeX error: Math version (.+?) is not defined/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_misplaced_alignment_tab_character',
    regexToMatch: /^Misplaced alignment tab character &/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_misplaced_cr',
    regexToMatch: /^Misplaced \\cr/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_misplaced_crcr',
    regexToMatch: /^Misplaced \\crcr/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_misplaced_noalign',
    regexToMatch: /^Misplaced \\noalign/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_misplaced_omit',
    regexToMatch: /^Misplaced \\omit/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_missing_begin_document',
    regexToMatch: /^LaTeX error: Missing \\begin{document}/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_missing_control_sequence_inserted',
    regexToMatch: /^Missing control sequence inserted/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_missing_cr_inserted',
    regexToMatch: /^Missing \\cr inserted/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_missing_delimiter_inserted',
    regexToMatch: /^Missing delimiter \(. inserted\)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_missing_endcsname_inserted',
    regexToMatch: /^Missing \\endcsname inserted/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_missing_number_treated_as_zero',
    regexToMatch: /^Missing number, treated as zero/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_missing_p_arg_in_array_arg',
    regexToMatch: /^LaTeX error: Missing p-arg in array arg/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_missing_exp_in_array_arg',
    regexToMatch: /^LaTeX error: Missing @-exp in array arg/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_missing_inserted_in_alignment_preamble',
    regexToMatch: /^Missing # inserted in alignment preamble/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_missing_inserted_for_ifnum',
    regexToMatch: /^Missing = inserted for \\ifnum/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_missing_inserted_for_ifdim',
    regexToMatch: /^Missing = inserted for \\ifdim/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_missing_inserted',
    regexToMatch: /^Missing \$ inserted/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_missing_endgroup_inserted',
    regexToMatch: /^Missing \\endgroup inserted/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_missing_right_inserted',
    regexToMatch: /^Missing \\right\. inserted/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_missing_inserted',
    regexToMatch: /^Missing \{ inserted/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_missing_inserted',
    regexToMatch: /^Missing } inserted/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_multiple_labels_label_tiquette_will_be_lost',
    regexToMatch:
      /^Package amsmath error: Multiple \\label's: label (.+?) will be lost/,
    package: 'amsmath',
  },
  {
    ruleId: 'hint_multiple_tag',
    regexToMatch: /^Package amsmath error: Multiple \\tag/,
    package: 'amsmath',
  },
  {
    ruleId: 'hint_no_counter_defined',
    regexToMatch: /^LaTeX error: No counter '(.+?)' defined/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_no_cyrillic_encoding_definition_files_were_found',
    regexToMatch:
      /^Package babel error: No Cyrillic encoding definition files were found/,
    package: 'babel',
  },
  {
    ruleId: 'hint_no_declaration_for_shape',
    regexToMatch: /^LaTeX error: No declaration for shape (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_no_driver_specified',
    regexToMatch:
      /^Package (color|graphics|graphicx) error: No driver specified/,
    package: 'color/graphics/graphicx',
  },
  {
    ruleId: 'hint_no_room_for_a_new_register',
    regexToMatch: /^No room for a new (.+)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_no_title_given',
    regexToMatch: /^LaTeX error: No \\title given/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_not_a_letter',
    regexToMatch: /^Not a letter/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_not_in_outer_par_mode',
    regexToMatch: /^LaTeX error: Not in outer par mode/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_number_too_big',
    regexToMatch: /^Number too big/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_ok_see_the_transcript_file',
    regexToMatch: /^OK \(see the transcript file\)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_old_form_should_be_begin',
    regexToMatch:
      /^Package amsmath error: Old form (.+?) should be \\begin{(.+?)} /,
    package: 'amsmath',
  },
  {
    ruleId: 'hint_only_one_is_allowed_per_tab',
    regexToMatch: /^Only one # is allowed per tab/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_option_clash_for_package',
    regexToMatch: /^LaTeX error: Option clash for package (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_page_height_already_too_large',
    regexToMatch: /^LaTeX error: Page height already too large/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_paragraph_ended_before_command_was_complete',
    regexToMatch: /^Paragraph ended before (.+?) was complete/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_please_type_a_command_or_say_end',
    regexToMatch: /^\(Please type a command or say `\\end'\)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_pushtabs_and_poptabs_dont_match',
    regexToMatch: /^LaTeX error: \\pushtabs and \\poptabs don't match/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_requirepackage_or_loadclass_in_options_section',
    regexToMatch:
      /^LaTeX error: \\RequirePackage or \\LoadClass in Options Section/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_rotation_not_supported',
    regexToMatch: /^Package (graphics|graphicx) error: Rotation not supported/,
    package: 'graphics/graphicx',
  },
  {
    ruleId: 'hint_runaway',
    regexToMatch: /^Runaway (.+)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_you_havent_specified_a_language_option',
    regexToMatch:
      /^Package babel error: You haven't specified a language option/,
    package: 'babel',
  },
]

const warnings: Rule[] = [
  {
    ruleId: 'hint_calculating_math_sizes_for_size',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Calculating math sizes for size (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_checking_defaults_for',
    regexToMatch: /^LaTeX (Font )?(Warning|Info): Checking defaults for (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_citation_on_page_undefined',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Citation `(.+?)' on page (.+?) undefined/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_command_invalid_in_math_mode',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Command (.+?) invalid in math mode/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_document_class',
    regexToMatch: /^LaTeX (Font )?(Warning|Info): Document Class\s*: (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_empty_thebibliography_environment',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Empty `thebibliography' environment/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_encoding_has_changed_to_for',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Encoding (.+?) has changed to (.+?) for/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_end_occurred_inside_a_group_at_level',
    regexToMatch: /^\(\\end occurred inside a group at level (.+)\)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_when_condition_on_line_was_incomplete',
    regexToMatch: /^\(\\end occurred when (.+?) on line (.+) was incomplete\)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_external_font_loaded_for_size',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): External font (.+?) loaded for size (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_faking_for_font_family_in_ts1_encoding',
    regexToMatch:
      /^Package TeXtcomp (Warning|Info): Faking (.+?) for font family (.+?) in TS1 encoding/,
    package: 'TeXtcomp',
  },
  {
    ruleId:
      'hint_file_already_exists_on_the_system_not_generating_it_from_this_source',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): File `(.+?)' already exists on the system\.\nNot generating it from this source\./,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_file',
    regexToMatch: /^LaTeX (Font )?(Warning|Info): File\s*: (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_file_font_definition',
    regexToMatch: /^LaTeX (Font )?(Warning|Info): File\s*: (.+?)\.fd (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_float_too_large_for_page_by',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Float too large for page by (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_font_shape_in_size_not_available_external_font_used',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Font shape (.+?) in size (.+?) not available\nexternal font (.+?) used/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_font_shape_in_size_not_available_size_substituted',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Font shape (.+?) in size (.+?) not available\nsize (.+?) substituted/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_font_shape_in_size_not_available_shape_forme_tried',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Font shape (.+?) in size (.+?) not available\nshape (.+?) tried/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_font_shape_forme_undefined_using_autre_forme_instead',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Font shape (.+?) undefined\. Using `(.+?)' instead/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_font_shape_forme_will_be_scaled_to_size_taille_',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Font shape (.+?) will be scaled to size (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_foreign_command',
    regexToMatch: /^Package amsmath (Warning|Info): Foreign command (.+?);/,
    package: 'amsmath',
  },
  {
    ruleId: 'hint_form_feed_has_been_converted_to_blank_line',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Form feed has been converted to Blank Line/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_float_specifier_changed',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): `(.+?)' float specifier changed to `(.+?)'/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_ignoring_text_after_end',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Ignoring text `(.+?)' after \\end{(.+?)}/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_label_multiply_defined',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Label `(.+?)' multiply defined/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_labels_may_have_changed_rerun_to_get_cross_references_right',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Label\(s\) may have changed\. Rerun to get cross-references right\./,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_loose_hbox_badness',
    regexToMatch: /^Loose \\hbox \(badness (.+?)\) (.+)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_loose_vbox_badness',
    regexToMatch: /^Loose \\vbox \(badness (.+?)\) (.+)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_making_an_active_character',
    regexToMatch:
      /^Package babel (Warning|Info): Making (.+?) an active character/,
    package: 'babel',
  },
  {
    ruleId: 'hint_marginpar_on_page_moved',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Marginpar on page (.+?) moved/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_missing_character_there_is_no_in_font',
    regexToMatch: /^Missing character\s*: There is no (.+?) in font (.+?)!/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_no_author_given',
    regexToMatch: /^LaTeX (Font )?(Warning|Info): No \\author given/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_no_auxiliary_output_files',
    regexToMatch: /^LaTeX (Font )?(Warning|Info): No auxiliary output files/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_no_characters_defined_by_input_encoding_change_to',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): No characters defined by input encoding change to (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_no_file',
    regexToMatch: /^LaTeX (Font )?(Warning|Info): No file (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_no_hyphenation_patterns_were_loaded_for_the_language',
    regexToMatch:
      /^Package babel (Warning|Info): No hyphenation patterns were loaded for the language `(.+?)'/,
    package: 'babel',
  },
  {
    ruleId: 'hint_no_input_encoding_specified_for_language',
    regexToMatch:
      /^Package babel (Warning|Info): No input encoding specified for (.+?) language/,
    package: 'babel',
  },
  {
    ruleId: 'hint_no_positions_in_optional_float_specifier',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): No positions in optional float specifier\./,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_oldstyle_digits_unavailable_for_family',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Oldstyle digits unavailable for family (.+)/,
    package: 'Textcomp',
  },
  {
    ruleId: 'hint_optional_argument_of_twocolumn_too_tall_on_page',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Optional argument of \\twocolumn too tall on page (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_oval_circle_or_line_size_unavailable',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): \\oval, \\circle, or \\line size unavailable/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_overfull_hbox_too_wide_quelque_part_',
    regexToMatch: /^Overfull \\hbox \((.+?)pt too wide\) (.+)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_overfull_vbox_pt_too_wide',
    regexToMatch: /^Overfull \\vbox \((.+?)pt too wide\)\) (.+)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_overwriting_encoding_scheme_quelque_chose_defaults',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Overwriting encoding scheme (.+?) defaults/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_overwriting_in_version',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Overwriting (.+?) in version `(.+)'/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_package',
    regexToMatch: /^LaTeX (Font )?(Warning|Info): Package: (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_redeclaring_font_encoding',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Redeclaring font encoding (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_redeclaring_math_accent',
    regexToMatch: /^LaTeX (Font )?(Warning|Info): Redeclaring math accent (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_redeclaring_math_alphabet',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Redeclaring math alphabet (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_redeclaring_math_symbol',
    regexToMatch: /^LaTeX (Font )?(Warning|Info): Redeclaring math symbol (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_redeclaring_math_version',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Redeclaring math version (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_redeclaring_symbol_font',
    regexToMatch: /^LaTeX (Font )?(Warning|Info): Redeclaring symbol font (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_reference_on_page_undefined',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Reference `(.+?)' on page (.+?) undefined/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_size_substitutions_with_differences_up_to_have_occurred',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Size substitutions with differences up to (.+?) have occurred/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_some_font_shapes_were_not_available_defaults_substituted',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Some font shapes were not available, defaults substituted/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_tab_has_been_converted_to_blank_space',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Tab has been converted to Blank Space/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_text_page_contains_only_floats',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): text page (.+?) contains only floats/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_there_were_multiply_defined_labels',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): There were multiply-defined labels/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_there_were_undefined_references',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): There were undefined references/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_tight_hbox_badness',
    regexToMatch: /^Tight \\hbox \(badness (.+?)\) (.+)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_tight_vbox_badness',
    regexToMatch: /^Tight \\vbox \(badness (.+?)\) (.+)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_try_loading_font_information_for',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Try loading font information for (.+?)\+(.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_unable_to_redefine_math_accent',
    regexToMatch:
      /^Package amsmath (Warning|Info): Unable to redefine math accent (.+)/,
    package: 'amsmath',
  },
  {
    ruleId: 'hint_hbox_badness_detected_at_line',
    regexToMatch:
      /^Underfull \\hbox \(badness (.+?)\) (.+?) detected at line (.+)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_hbox_badness_has_occurred_while_output_is_active',
    regexToMatch:
      /^Underfull \\hbox \(badness (.+?)\) (.+?) has occurred while \\output is active/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_hbox_badness_in_alignment_at_lines',
    regexToMatch:
      /^Underfull \\hbox \(badness (.+?)\) (.+?) in alignment at lines (.+)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_hbox_badness_in_paragraph_at_lines',
    regexToMatch:
      /^Underfull \\hbox \(badness (.+?)\) (.+?) in paragraph at lines (.+)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_vbox_badness_detected_at_line',
    regexToMatch:
      /^Underfull \\vbox \(badness (.+?)\) (.+?) detected at line (.+)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_vbox_badness_has_occurred_while_output_is_active',
    regexToMatch:
      /^Underfull \\vbox \(badness (.+?)\) (.+?) has occurred while \\output is active/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_vbox_badness_in_alignment_at_lines',
    regexToMatch:
      /^Underfull \\vbox \(badness (.+?)\) (.+?) in alignment at lines (.+)/,
    package: 'TeX',
  },
  {
    ruleId: 'hint_unused_global_options',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Unused global option\(s\)\s*: \[(.+?)]/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_writing_file',
    regexToMatch: /^LaTeX (Font )?(Warning|Info): Writing file `(.+?)'/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_writing_text_before_end_as_last_line_of',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): Writing text `(.+?)' before \\end{(.+?)} as last line of (.+)/,
    package: 'LaTeX',
  },
  {
    ruleId: 'hint_you_have_more_than_once_selected_the_attribute_for_language',
    regexToMatch:
      /^Package babel (Warning|Info): You have more than once selected the attribute `(.+?)' for language (.+)/,
    package: 'babel',
  },
  {
    ruleId:
      'hint_you_have_requested_package_or_class_but_the_package_or_class_provides',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): You have requested (package|class) `(.+?)', but the (package|class) provides `(.+?)'/,
    package: 'LaTeX',
  },
  {
    ruleId:
      'hint_you_have_requested_release_date_of_latex_but_only_release_ancienne_date_is_available',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): You have requested release `(.+?)' of LaTeX, but only release `(.+?)' is available/,
    package: 'LaTeX',
  },
  {
    ruleId:
      'hint_you_have_requested_on_line_version_of_but_only_version_is_available',
    regexToMatch:
      /^LaTeX (Font )?(Warning|Info): You have requested, on line (.+?), version `(.+?)' of (.+?), but only version `(.+?)' is available/,
    package: 'LaTeX',
  },
]

export default [...rules, ...errors, ...warnings]
