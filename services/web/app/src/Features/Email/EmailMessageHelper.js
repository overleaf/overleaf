function displayLink(text, url, isPlainText) {
  return isPlainText ? `${text} (${url})` : `<a href="${url}">${text}</a>`
}

module.exports = {
  displayLink
}
