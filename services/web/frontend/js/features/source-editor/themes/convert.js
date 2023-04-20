/**
Convert Ace themes to CodeMirror 6

Tokens:
https://github.com/ajaxorg/ace/wiki/Creating-or-Extending-an-Edit-Mode#common-tokens

Highlight Rules:
https://github.com/overleaf/ace/blob/overleaf/lib/ace/mode/latex_highlight_rules.js

Conversion of TextMate themes to Ace:
https://github.com/ajaxorg/ace/wiki/Importing-.tmtheme-and-.tmlanguage-Files-into-Ace
https://github.com/ajaxorg/ace/blob/master/tool/tmtheme.js
*/

const fs = require('fs')
const globby = require('globby')
const mensch = require('mensch')
const path = require('path')
const overrides = require('./overrides.json')
const { merge } = require('lodash')

// CSS files from https://github.com/overleaf/ace/tree/overleaf/lib/ace/theme copied into the "ace" folder
const themePaths = globby.sync(['ace/*.css'], { cwd: __dirname })

const outputDir = path.join(__dirname, 'cm6')

// from js/ide.js
const darkThemes = [
  'ambiance',
  'chaos',
  'clouds_midnight',
  'cobalt',
  'dracula',
  'gob',
  'gruvbox',
  'idle_fingers',
  'kr_theme',
  'merbivore',
  'merbivore_soft',
  'mono_industrial',
  'monokai',
  'nord_dark',
  'pastel_on_dark',
  'solarized_dark',
  'terminal',
  'tomorrow_night',
  'tomorrow_night_blue',
  'tomorrow_night_bright',
  'tomorrow_night_eighties',
  'twilight',
  'vibrant_ink',
]

// manual mapping of Ace selectors to CM6 theme selectors
const themeMapping = new Map([
  ['.ace_gutter', '.cm-gutters'],
  ['.ace_cursor', '.cm-cursor, .cm-dropCursor'],
  [
    '.ace_marker-layer .ace_selection',
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection, .cm-searchMatch.cm-searchMatch.cm-searchMatch-selected',
  ],
  [
    '.ace_marker-layer .ace_selected-word',
    '.cm-selectionMatch.cm-selectionMatch, .cm-searchMatch.cm-searchMatch', // doubled to increase specificity over defaults
  ],
  [
    '.ace_marker-layer .ace_bracket',
    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket',
  ],
  ['.ace_marker-layer .ace_bracket-unmatched', '.cm-nonmatchingBracket'],
  ['.ace_marker-layer .ace_active-line', '.cm-activeLine'],
  ['.ace_gutter-active-line', '.cm-activeLineGutter'],
  ['.ace_fold', '.cm-foldPlaceholder'],
])

const propertyRemapping = new Map([
  [
    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket',
    [['border', 'outline']],
  ],
  [
    '.cm-selectionMatch.cm-selectionMatch, .cm-searchMatch.cm-searchMatch',
    [['border', 'outline']],
  ],
])

function remap(selector, rule) {
  const remappings = propertyRemapping.get(selector) ?? []
  for (const [oldKey, newKey] of remappings) {
    if (newKey in rule) {
      throw new Error(
        `Invalid remapping. Property ${newKey} already exists in rule '${selector}'`
      )
    }
    if (oldKey in rule) {
      rule[newKey] = rule[oldKey]
      delete rule[oldKey]
    }
  }
  return rule
}
// manual mapping of Ace selectors to CM6 highlight style selectors
// https://codemirror.net/6/docs/ref/#highlight.tags
// (the classHighlightStyle extension adds the class names for styling)
const highlightStyleMapping = new Map([
  // ['.ace_support.ace_type', '.tok-typeName'],
  ['.ace_class', '.tok-class'],
  ['.ace_comment', '.tok-comment'],
  ['.ace_constant', '.tok-labelName'],
  ['.ace_constant.ace_character', '.tok-literal'],
  ['.ace_constant.ace_character.ace_escape', '.tok-literal'], // escape
  ['.ace_constant.ace_language', '.tok-literal'], // constant
  ['.ace_constant.ace_numeric', '.tok-literal'], // number
  ['.ace_constant.ace_other', '.tok-literal'], // constant
  ['.ace_entity.ace_name.ace_function', '.tok-function'],
  ['.ace_entity.ace_name.ace_tag', '.tok-tagName'],
  ['.ace_entity.ace_other.ace_attribute-name', '.tok-attributeName'],
  ['.ace_heading', '.tok-heading'],
  ['.ace_identifier', '.tok-string'], // TODO: identifier?
  ['.ace_invalid', '.tok-invalid'],
  ['.ace_keyword', '.tok-keyword'], // typeName?
  ['.ace_keyword.ace_operator', '.tok-operator'],
  ['.ace_list', '.tok-list'],
  ['.ace_lparen', '.tok-paren'],
  ['.ace_markup.ace_heading', '.tok-heading'],
  ['.ace_markup.ace_list', '.tok-list'],
  ['.ace_numeric', '.tok-number'],
  ['.ace_punctuation', '.tok-punctuation'],
  ['.ace_regexp', '.tok-string2'],
  ['.ace_rparen', '.tok-paren'],
  ['.ace_storage', '.tok-typeName'],
  ['.ace_storage.ace_type', '.tok-typeName'],
  ['.ace_string', '.tok-string'],
  ['.ace_string.ace_regexp', '.tok-regexp'],
  // ['.ace_support.ace_class', '.tok-className'],
  // ['.ace_support.ace_constant', '.tok-constant'],
  // ['.ace_support.ace_function', '.tok-function'],
  // ['.ace_support.ace_type', '.tok-function'],
  ['.ace_type', '.tok-typeName'],
  ['.ace_variable', '.tok-attributeValue'], // keyword // variableName
  ['.ace_variable.ace_language', '.tok-variableName'],
  ['.ace_variable.ace_parameter', '.tok-attributeValue'], // string
])

for (const themePath of themePaths) {
  console.log(themePath)

  const input = fs.readFileSync(path.join(__dirname, themePath), 'utf-8')

  const ast = mensch.parse(input)

  const themeStyles = {
    // these styles should only be set if they're defined in a theme
    '.cm-gutters': {
      backgroundColor: 'transparent',
      borderRightColor: 'transparent',
    },
  }
  const highlightStyles = {}

  for (const rule of ast.stylesheet.rules) {
    const declarations = {}

    rule.declarations
      .filter(item => item.type === 'property')
      .forEach(declaration => {
        // convert CSS property to snake case
        const property = declaration.name.replace(/-(\w)/g, (_, letter) => {
          return letter.toUpperCase()
        })
        declarations[property] = declaration.value
      })

    for (const item of rule.selectors) {
      // ignore the first selector, which is the theme class
      const selector = item.split(/\s+/).slice(1).join(' ')

      // an empty selector was the theme class selector for the whole editor
      if (selector === '') {
        themeStyles['&'] = {
          ...themeStyles['&'],
          ...declarations,
        }
        continue
      }

      if (themeMapping.has(selector)) {
        const key = themeMapping.get(selector)
        themeStyles[key] = remap(key, {
          ...themeStyles[key],
          ...declarations,
        })
      } else if (highlightStyleMapping.has(selector)) {
        const key = highlightStyleMapping.get(selector)
        highlightStyles[key] = remap(key, {
          ...highlightStyles[key],
          ...declarations,
        })
      }
    }
  }

  console.log('theme', themeStyles)
  console.log('highlight', highlightStyles)

  const basename = path.basename(themePath, '.css')

  const themeOverrides = merge({}, overrides.all, overrides[basename])

  const theme = merge({}, themeStyles, themeOverrides.theme)

  const highlightStyle = merge(
    {},
    highlightStyles,
    themeOverrides.highlightStyle
  )

  const dark = darkThemes.includes(basename)

  const output = JSON.stringify({ theme, highlightStyle, dark }, null, 2)

  const outputPath = path.join(outputDir, `${basename}.json`)

  fs.writeFileSync(outputPath, output + '\n')

  if (basename !== 'overleaf') {
    copyLicense(basename)
  }
}

function copyLicense(basename) {
  const jsFilePath = path.join(__dirname, 'ace', `${basename}.js`)
  if (fs.existsSync(jsFilePath)) {
    const js = fs.readFileSync(jsFilePath, 'utf-8')
    const match = js.match(/\*+ BEGIN LICENSE BLOCK .+? END LICENSE BLOCK \*+/s)
    if (match) {
      const license = match[0].replace(/\n \* ?/g, '\n')
      const output = `Conversion by Overleaf from Ace to CodeMirror 6.\n\nSource: https://github.com/ajaxorg/ace/\n\nThe theme's original license is copied below:\n\n${license}`
      const licenseOutputPath = path.join(outputDir, `${basename}-license.txt`)
      fs.writeFileSync(licenseOutputPath, output)
    } else {
      console.warn(`No license in ${jsFilePath}`)
    }
  } else {
    console.warn(`No license file for ${basename}`)
  }
}
