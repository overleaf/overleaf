import sanitizeHtml from 'sanitize-html'
const sanitizeOptions = {
  html: {
    allowedTags: ['a', 'span', 'b', 'br', 'i'],
    allowedAttributes: {
      a: ['href', 'style'],
      span: ['style', 'class'],
    },
  },
  plainText: {
    allowedTags: [],
    allowedAttributes: {},
  },
}

function cleanHTML(text, isPlainText) {
  if (!isPlainText) return sanitizeHtml(text, sanitizeOptions.html)
  return sanitizeHtml(text, sanitizeOptions.plainText)
}

function displayLink(text, url, isPlainText) {
  return isPlainText ? `${text} (${url})` : `<a href="${url}">${text}</a>`
}

export default {
  cleanHTML,
  displayLink,
}
