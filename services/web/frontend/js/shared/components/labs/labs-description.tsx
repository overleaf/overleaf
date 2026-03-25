import { FC, useMemo } from 'react'
import { micromark } from 'micromark'
import DOMPurify from 'dompurify'

const PURIFY_CONFIG = {
  ALLOWED_TAGS: ['#text', 'p', 'em', 'strong', 'a'],
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
 * Only bold, italic, and links are supported.
 */
export const LabsDescription: FC<{ description: string }> = ({
  description,
}) => {
  const html = useMemo(() => sanitizeDescription(description), [description])

  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
