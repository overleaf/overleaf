// @ts-check
'use strict'

/**
 * The file names that may hold editable text, as data.
 *
 * These lists decide whether a file becomes a doc or a binary file (see
 * lib/file_type_detector.js), so every service that classifies a file has to
 * work from the same list: one carrying a shorter copy turns the same bytes into
 * a binary file, and a project changes the type of a file just by taking a
 * different path into history. Consumers read them from here instead of carrying
 * a copy. web layers the ADDITIONAL_TEXT_EXTENSIONS override on top for Server
 * CE/Pro.
 *
 * Frozen because they are shared: copy them (`.concat(...)`, `.slice()`) before
 * handing them to anything that merges configuration into its own objects.
 *
 * When adding an extension, see
 * developer-manual/development/code/editable-text-file-extensions.md for the
 * other places that need touching.
 */

/**
 * Extensions without a leading dot, lower case.
 *
 * @type {ReadonlyArray<string>}
 */
const DEFAULT_TEXT_EXTENSIONS = Object.freeze([
  'tex',
  'latex',
  'sty',
  'cls',
  'bst',
  'bib',
  'bibtex',
  'txt',
  'tikz',
  'mtx',
  'rtex',
  'md',
  'asy',
  'lbx',
  'bbx',
  'cbx',
  'm',
  'lco',
  'dtx',
  'ins',
  'ist',
  'def',
  'clo',
  'ldf',
  'rmd',
  'qmd',
  'lua',
  'py',
  'gv',
  'mf',
  'yml',
  'yaml',
  'lhs',
  'lean',
  'lean4',
  'hs',
  'mk',
  'xmpdata',
  'cfg',
  'rnw',
  'ltx',
  'inc',
])

/**
 * Extensions a doc may have to be the one a project compiles from.
 *
 * A subset of the text extensions above: every one of these is editable, and most of
 * the editable ones cannot be a root doc. Shared for the same reason as the list it is
 * drawn from -- the answer has to be the same wherever a project is created, and a
 * writer holding a shorter copy leaves a project with nothing to compile.
 *
 * @type {ReadonlyArray<string>}
 */
const DEFAULT_ROOT_DOC_EXTENSIONS = Object.freeze(['tex', 'Rtex', 'ltx', 'Rnw'])

/**
 * Whole file names, lower case, editable whatever their extension says.
 *
 * @type {ReadonlyArray<string>}
 */
const DEFAULT_EDITABLE_FILENAMES = Object.freeze([
  'latexmkrc',
  '.latexmkrc',
  'makefile',
  'gnumakefile',
])

module.exports = {
  DEFAULT_TEXT_EXTENSIONS,
  DEFAULT_EDITABLE_FILENAMES,
  DEFAULT_ROOT_DOC_EXTENSIONS,
}
