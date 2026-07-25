import { InlineContext, MarkdownConfig, InlineParser } from '@lezer/markdown'

const DOLLAR = 36 /* '$' */

// Whitespace (including the start/end of the inline section, where `char`
// returns -1).
const isSpace = (code: number) =>
  code === -1 || code === 32 || code === 9 || code === 10 || code === 13

const isDigit = (code: number) => code >= 48 && code <= 57

const InlineMathDelim = { resolve: 'InlineMath', mark: 'InlineMathMark' }
const BlockMathDelim = { resolve: 'BlockMath', mark: 'BlockMathMark' }

// Inline parsing runs over the whole paragraph, so `$$…$$` handles multi-line
// equations as long as there is no blank line inside them.
const blockMathParser: InlineParser = {
  name: 'BlockMath',
  parse(cx: InlineContext, next: number, pos: number) {
    if (next !== DOLLAR || cx.char(pos + 1) !== DOLLAR) {
      return -1
    }
    return cx.addDelimiter(BlockMathDelim, pos, pos + 2, true, true)
  },
  // Run before the default `Emphasis` parser, and (via `InlineMath`'s `after`)
  // before the single-dollar inline parser, so `$$` is matched as a display
  // delimiter rather than two empty inline ones.
  before: 'Emphasis',
}

const inlineMathParser: InlineParser = {
  name: 'InlineMath',
  parse(cx: InlineContext, next: number, pos: number) {
    if (next !== DOLLAR) {
      return -1
    }
    const before = cx.char(pos - 1)
    const after = cx.char(pos + 1)
    const canOpen = !isSpace(after)
    const canClose = !isSpace(before) && !isDigit(after)
    if (!canOpen && !canClose) {
      return -1
    }
    return cx.addDelimiter(InlineMathDelim, pos, pos + 1, canOpen, canClose)
  },
  // Run after `BlockMath` so `$$` is tried as a display delimiter first, but
  // still before `Emphasis`. The default `Escape` parser consumes `\$` first.
  after: 'BlockMath',
}

export const Math: MarkdownConfig = {
  // No `style` is set on these nodes: math is rendered by the visual editor
  // (which slices the raw source), so the grammar change stays inert for
  // source-mode syntax highlighting and non-experiment users.
  defineNodes: ['InlineMath', 'InlineMathMark', 'BlockMath', 'BlockMathMark'],
  parseInline: [blockMathParser, inlineMathParser],
}
