import { LaTeXLanguage } from '@/features/source-editor/languages/latex/latex-language'
import { WordCountData } from '@/features/word-count-modal/components/word-count-data'
import { NodeType, SyntaxNodeRef } from '@lezer/common'
import { debugConsole } from '@/utils/debugging'
import { findPreambleExtent } from '@/features/word-count-modal/utils/find-preamble-extent'
import { Segmenters } from './segmenters'

const whiteSpaceRe = /^\s$/

type Context = 'text' | 'header' | 'abstract' | 'caption' | 'footnote' | 'other'

const counters: Record<
  Context,
  {
    word: keyof WordCountData
    character: keyof WordCountData
  }
> = {
  text: {
    word: 'textWords',
    character: 'textCharacters',
  },
  header: {
    word: 'headWords',
    character: 'headCharacters',
  },
  abstract: {
    word: 'abstractWords',
    character: 'abstractCharacters',
  },
  caption: {
    word: 'captionWords',
    character: 'captionCharacters',
  },
  footnote: {
    word: 'footnoteWords',
    character: 'footnoteCharacters',
  },
  other: {
    word: 'otherWords',
    character: 'otherCharacters',
  },
}

// https://en.wikibooks.org/wiki/LaTeX/Special_Characters#Escaped_codes
const replacementsMap: Map<string, string> = new Map([
  // LaTeX commands that create characters
  ['aa', 'å'],
  ['AA', 'Å'],
  ['ae', 'æ'],
  ['AE', 'Æ'],
  ['oe', 'œ'],
  ['OE', 'Œ'],
  ['o', 'ø'],
  ['O', 'Ø'],
  ['ss', 'ß'],
  ['SS', 'SS'],
  ['l', 'ł'],
  ['L', 'Ł'],
  ['dh', 'ð'],
  ['DH', 'Ð'],
  ['dj', 'đ'],
  ['DJ', 'Ð'],
  ['th', 'þ'],
  ['TH', 'Þ'],
  ['ng', 'ŋ'],
  ['NG', 'Ŋ'],
  ['i', 'ı'],
  ['j', 'ȷ'],
  // reserved characters
  ['&', '&'],
  ['$', '$'],
  ['%', '%'],
  ['#', '#'],
  ['_', '_'],
  ['{', '{'],
  ['}', '}'],
  // modifier commands for the subsequent character(s) (in braces)
  ['H', 'ő'], // long Hungarian umlaut (double acute)
  ['b', 'o'], // bar under the letter
  ['c', 'ç'], // cedilla
  ['d', 'o'], // dot under the letter
  ['k', 'ą'], // ogonek
  ['r', 'å'], // ring over the letter
  ['t', 'o͡o'], // "tie" over the two letters
  ['u', 'ŏ'], // breve over the letter
  ['v', 'š'], // caron/háček over the letter
  // modifier symbols for the subsequent character
  ["'", ''], // acute
  ['^', ''], // circumflex
  ['"', ''], // umlaut, trema or dieresis
  ['=', ''], // macron accent (a bar over the letter)
  ['.', ''], // dot over the letter
  ['`', ''], // grave
  ['~', ''], // tilde
  // commands that create text
  ['TeX', 'TeX'],
  ['LaTeX', 'LaTeX'],
  ['textbackslash', '\\'],
])

type TextNode = {
  from: number
  to: number
  text: string
  context: Context
}

export const countWordsInFile = (
  data: WordCountData,
  projectSnapshot: { getDocContents(path: string): string | null },
  docPath: string,
  segmenters: Segmenters
) => {
  debugConsole.log(`Counting words in ${docPath}`)

  const content = projectSnapshot.getDocContents(docPath) // TODO: try with extensions
  if (!content) return

  // TODO: language from file extension
  const tree = LaTeXLanguage.parser.parse(content)

  let currentContext: Context = 'text'

  const textNodes: TextNode[] = []

  const iterateNode = (nodeRef: SyntaxNodeRef, context: Context = 'text') => {
    const previousContext = currentContext
    currentContext = context
    nodeRef.node.cursor().iterate(childNodeRef => {
      // TODO: a better way to iterate only descendants?
      if (childNodeRef.node !== nodeRef.node) {
        return bodyMatcher(childNodeRef.type)?.(childNodeRef)
      }
    })
    currentContext = previousContext
  }

  const headMatcher = NodeType.match<
    (nodeRef: SyntaxNodeRef) => boolean | void
  >({
    Title(nodeRef) {
      data.headers++
      iterateNode(nodeRef, 'header')
      return false
    },
  })

  const bodyMatcher = NodeType.match<
    (nodeRef: SyntaxNodeRef) => boolean | void
  >({
    Normal(nodeRef) {
      textNodes.push({
        from: nodeRef.from,
        to: nodeRef.to,
        text: content.substring(nodeRef.from, nodeRef.to),
        context: currentContext,
      })
    },
    Command(nodeRef) {
      const child = nodeRef.node.getChild('UnknownCommand')
      if (!child) return

      const grandchild =
        child.getChild('$CtrlSeq') ?? child.getChild('$CtrlSym')
      if (!grandchild) return

      const commandName = content.substring(grandchild.from + 1, grandchild.to)
      if (!commandName) return

      switch (commandName) {
        case 'thanks':
          iterateNode(nodeRef, 'other')
          return false
      }

      if (!replacementsMap.has(commandName)) return

      // TODO: handle accented character in braces after a CtrlSym, e.g. \'{a}
      // TODO: handle markup within words, e.g. inter\textbf{nal}formatting
      // TODO: handle commands like \egrave and \eacute

      const text = replacementsMap.get(commandName)!

      textNodes.push({
        from: nodeRef.from,
        to: nodeRef.to,
        text,
        context: currentContext,
      })

      return false
    },
    $Environment(nodeRef) {
      const envNameNode = nodeRef.node
        .getChild('BeginEnv')
        ?.getChild('EnvNameGroup')
        ?.getChild('EnvName')

      if (envNameNode) {
        const envName = content
          ?.substring(envNameNode.from, envNameNode.to)
          .replace(/\*$/, '')

        if (envName === 'abstract') {
          data.headers++

          const contentNode = nodeRef.node.getChild('Content')
          if (contentNode) {
            iterateNode(contentNode, 'abstract')
          }

          return false
        }
      }
    },
    BeginEnv() {
      return false // ignore text in \begin arguments
    },
    Math(nodeRef) {
      const parent = nodeRef.node.parent
      if (parent?.type.is('InlineMath') || parent?.type.is('ParenMath')) {
        data.mathInline++
      } else {
        data.mathDisplay++
      }

      return false // TODO: count \text in math nodes?
    },
    'ShortTextArgument ShortOptionalArg'() {
      return false
    },
    SectioningArgument(nodeRef) {
      data.headers++
      iterateNode(nodeRef, 'header')
      return false
    },
    Caption(nodeRef) {
      iterateNode(nodeRef, 'caption')
      return false
    },
    'FootnoteCommand EndnoteCommand'(nodeRef) {
      iterateNode(nodeRef, 'footnote')
      return false
    },
    'IncludeArgument InputArgument'(nodeRef) {
      let path = content.substring(nodeRef.from + 1, nodeRef.to - 1)
      if (!/\.\w+$/.test(path)) {
        path += '.tex'
      }
      debugConsole.log(path)
      if (path) {
        countWordsInFile(data, projectSnapshot, path, segmenters)
      }
    },
    'BlankLine LineBreak'(nodeRef) {
      textNodes.push({
        from: nodeRef.from,
        to: nodeRef.to,
        text: '\n',
        context: currentContext,
      })
    },
  })

  const preambleExtent = findPreambleExtent(tree)

  tree.iterate({
    from: 0,
    to: preambleExtent.to,
    enter(nodeRef) {
      return headMatcher(nodeRef.type)?.(nodeRef)
    },
  })

  tree.iterate({
    from: preambleExtent.to,
    enter(nodeRef) {
      return bodyMatcher(nodeRef.type)?.(nodeRef)
    },
  })

  const texts: Record<Context, string> = {
    abstract: '',
    header: '',
    caption: '',
    text: '',
    footnote: '',
    other: '',
  }

  let pos = 0
  for (const textNode of textNodes) {
    if (textNode.from !== pos) {
      texts[textNode.context] += ' '
    }
    texts[textNode.context] += textNode.text
    pos = textNode.to
  }

  for (const [context, text] of Object.entries(texts)) {
    const counter = counters[context as Context]

    // TODO: replace - and _ with a word character if hyphenated words should be counted as one word?

    for (const value of segmenters.word.segment(
      text.replace(/\w[-_]\w/g, 'aaa')
    )) {
      if (value.isWordLike) {
        data[counter.word]++
      }
    }

    // TODO: count hyphens as characters?

    for (const value of segmenters.character.segment(text)) {
      // TODO: option for whether to include whitespace?
      if (!whiteSpaceRe.test(value.segment)) {
        data[counter.character]++
      }
    }
  }
}
