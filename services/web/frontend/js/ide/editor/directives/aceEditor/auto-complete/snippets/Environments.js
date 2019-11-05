/* eslint-disable
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
define(function() {
  const envs = [
    'abstract',
    'align',
    'align*',
    'equation',
    'equation*',
    'gather',
    'gather*',
    'multline',
    'multline*',
    'split',
    'verbatim',
    'quote',
    'center'
  ]

  const envsWithSnippets = [
    'array',
    'figure',
    'tabular',
    'table',
    'list',
    'enumerate',
    'itemize',
    'frame',
    'thebibliography'
  ]

  return {
    all: envs.concat(envsWithSnippets),
    withoutSnippets: envs
  }
})
