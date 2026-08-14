import { FC, useMemo } from 'react'
import { micromark } from 'micromark'
import DOMPurify from 'dompurify'

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    '#text',
    'p',
    'em',
    'strong',
    'a',
    'code',
    'pre',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
  ],
  ALLOWED_ATTR: ['href'],
}

const LINK_REL = 'noreferrer noopener'
const LINK_TARGET = '_BLANK'

function sanitizeDescription(description: string) {
  DOMPurify.addHook('afterSanitizeAttributes', node => {
    if (node.nodeName === 'A') {
      node.setAttribute('rel', LINK_REL)
      node.setAttribute('target', LINK_TARGET)
    }
  })

  try {
    return DOMPurify.sanitize(micromark(description), PURIFY_CONFIG)
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes')
  }
}

/**
 * Renders a labs experiment description from markdown to sanitized HTML.
 * Only bold, italic, links, headings, inline code and code blocks are
 * supported. Note that the language of a fenced code block is discarded, as
 * the `class` attribute micromark puts it in is not allowed through.
 */
export const LabsDescription: FC<{ description: string }> = ({
  description,
}) => {
  const html = useMemo(() => sanitizeDescription(description), [description])

  return (
    <div
      className="labs-description"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
