import { ProjectSnapshot } from '@/infrastructure/project-snapshot'
import { LaTeXLanguage } from '@/features/source-editor/languages/latex/latex-language'
import { WordCountData } from '@/features/word-count-modal/components/word-count-data'
import { NodeType, SyntaxNodeRef } from '@lezer/common'
import { debugConsole } from '@/utils/debugging'
import { findPreambleExtent } from '@/features/word-count-modal/utils/find-preamble-extent'
import { Segmenters } from './segmenters'

const whiteSpaceRe = /^\s$/

type Context = 'text' | 'header' | 'abstract' | 'caption' | 'footnote'

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
}

const replacementsMap: Map<string, string> = new Map([
  // LaTeX commands that create part of a word
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
  ['_', '_'],
  // modifier commands for the character in the arguments
  ['H', 'a'],
  ['c', 'a'],
  ['d', 'a'],
  ['k', 'a'],
  ['v', 'a'],
  // modifier symbols for the subsequent character
  ["'", ''],
  ['^', ''],
  ['"', ''],
  ['=', ''],
  ['.', ''],
])

type TextNode = {
  from: number
  to: number
  text: string
  context: Context
}

export const countWordsInFile = (
  data: WordCountData,
  projectSnapshot: ProjectSnapshot,
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
    const { node } = nodeRef
    node.cursor().iterate(childNodeRef => {
      // TODO: a better way to iterate only descendants?
      if (childNodeRef.node !== node) {
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

      const grandchild = child.getChild('CtrlSeq') ?? child.getChild('CtrlSym')
      if (!grandchild) return

      const commandName = content.substring(grandchild.from + 1, grandchild.to)
      if (!commandName) return

      if (!replacementsMap.has(commandName)) return

      const text = replacementsMap.get(commandName)!
      textNodes.push({
        from: nodeRef.from,
        to: nodeRef.to,
        text,
        context: currentContext,
      })
      return false
    },
    BeginEnv(nodeRef) {
      const envName = content
        ?.substring(nodeRef.from + '\\begin{'.length, nodeRef.to - 1)
        .replace(/\*$/, '')

      if (envName === 'abstract') {
        data.headers++
        iterateNode(nodeRef, 'abstract')
        return false
      }
    },
    'ShortTextArgument ShortOptionalArg'() {
      return false
    },
    SectioningArgument(nodeRef) {
      data.headers++
      iterateNode(nodeRef, 'header')
      return false
    },
    'DisplayMath BracketMath'() {
      data.mathDisplay++
    },
    'InlineMath ParenMath'() {
      data.mathInline++
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

    for (const value of segmenters.word.segment(text)) {
      if (value.isWordLike) {
        data[counter.word]++
      }
    }

    for (const value of segmenters.character.segment(text)) {
      // TODO: option for whether to include whitespace?
      if (!whiteSpaceRe.test(value.segment)) {
        data[counter.character]++
      }
    }
  }
}
