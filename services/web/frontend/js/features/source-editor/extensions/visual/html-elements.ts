// elements which should contain only block elements
const blockContainingElements = new Set([
  'DL',
  'FIELDSET',
  'FIGURE',
  'HEAD',
  'OL',
  'TABLE',
  'TBODY',
  'TFOOT',
  'THEAD',
  'TR',
  'UL',
])

export const isBlockContainingElement = (node: Node): node is HTMLElement =>
  blockContainingElements.has(node.nodeName)

// elements which are block elements (as opposed to inline elements)
const blockElements = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'BODY',
  'CANVAS',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HGROUP',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'NOSCRIPT',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TBODY',
  'TD',
  'TFOOT',
  'TH',
  'THEAD',
  'TR',
  'UL',
  'VIDEO',
])

export const isBlockElement = (node: Node): node is HTMLElement =>
  blockElements.has(node.nodeName)

const inlineElements = new Set([
  'A',
  'ABBR',
  'ACRONYM',
  'B',
  'BIG',
  'CITE',
  'DEL',
  'EM',
  'I',
  'INS',
  'SMALL',
  'SPAN',
  'STRONG',
  'SUB',
  'SUP',
  'TEXTAREA', // TODO
  'TIME',
  'TT',
])

export const isInlineElement = (node: Node): node is HTMLElement =>
  inlineElements.has(node.nodeName)

const keepEmptyBlockElements = new Set(['TD', 'TH', 'CANVAS', 'DT', 'DD', 'HR'])

export const shouldRemoveEmptyBlockElement = (
  node: Node
): node is HTMLElement =>
  !keepEmptyBlockElements.has(node.nodeName) && !node.hasChildNodes()

export const isTextNode = (node: Node): node is Text =>
  node.nodeType === Node.TEXT_NODE

export const isElementNode = (node: Node): node is HTMLElement =>
  node.nodeType === Node.ELEMENT_NODE
