/* eslint-disable
    max-len,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([], function() {
  const packages = [
    'inputenc',
    'graphicx',
    'amsmath',
    'geometry',
    'amssymb',
    'hyperref',
    'babel',
    'color',
    'xcolor',
    'url',
    'natbib',
    'fontenc',
    'fancyhdr',
    'amsfonts',
    'booktabs',
    'amsthm',
    'float',
    'tikz',
    'caption',
    'setspace',
    'multirow',
    'array',
    'multicol',
    'titlesec',
    'enumitem',
    'ifthen',
    'listings',
    'blindtext',
    'subcaption',
    'times',
    'bm',
    'subfigure',
    'algorithm',
    'fontspec',
    'biblatex',
    'tabularx',
    'microtype',
    'etoolbox',
    'parskip',
    'calc',
    'verbatim',
    'mathtools',
    'epsfig',
    'wrapfig',
    'lipsum',
    'cite',
    'textcomp',
    'longtable',
    'textpos',
    'algpseudocode',
    'enumerate',
    'subfig',
    'pdfpages',
    'epstopdf',
    'latexsym',
    'lmodern',
    'pifont',
    'ragged2e',
    'rotating',
    'dcolumn',
    'xltxtra',
    'marvosym',
    'indentfirst',
    'xspace',
    'csquotes',
    'xparse',
    'changepage',
    'soul',
    'xunicode',
    'comment',
    'mathrsfs',
    'tocbibind',
    'lastpage',
    'algorithm2e',
    'pgfplots',
    'lineno',
    'graphics',
    'algorithmic',
    'fullpage',
    'mathptmx',
    'todonotes',
    'ulem',
    'tweaklist',
    'moderncvstyleclassic',
    'collection',
    'moderncvcompatibility',
    'gensymb',
    'helvet',
    'siunitx',
    'adjustbox',
    'placeins',
    'colortbl',
    'appendix',
    'makeidx',
    'supertabular',
    'ifpdf',
    'framed',
    'aliascnt',
    'layaureo',
    'authblk'
  ]

  class PackageManager {
    constructor(metadataManager) {
      this.metadataManager = metadataManager
    }

    getCompletions(editor, session, pos, prefix, callback) {
      const usedPackages = Object.keys(this.metadataManager.getAllPackages())
      const packageSnippets = []
      for (let pkg of Array.from(packages)) {
        if (!Array.from(usedPackages).includes(pkg)) {
          packageSnippets.push({
            caption: `\\usepackage{${pkg}}`,
            snippet: `\\usepackage{${pkg}}`,
            meta: 'pkg'
          })
        }
      }

      packageSnippets.push({
        caption: '\\usepackage{}',
        snippet: '\\usepackage{$1}',
        meta: 'pkg',
        score: 70
      })
      return callback(null, packageSnippets)
    }
  }

  return PackageManager
})
