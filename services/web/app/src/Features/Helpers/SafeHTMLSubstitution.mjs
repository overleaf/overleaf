import pug from 'pug-runtime'

const SPLIT_REGEX = /<(\d+)>(.*?)<\/\1>/g

function render(locale, components) {
  const output = []
  function addPlainText(text) {
    if (!text) return
    output.push(pug.escape(text))
  }

  // 'PRE<0>INNER</0>POST'        -> ['PRE', '0', 'INNER', 'POST']
  // '<0>INNER</0>'               -> ['', '0', 'INNER', '']
  // '<0></0>'                    -> ['', '0', '', '']
  // '<0>INNER</0><0>INNER2</0>'  -> ['', '0', 'INNER', '', '0', 'INNER2', '']
  // '<0><1>INNER</1></0>'        -> ['', '0', '<1>INNER</1>', '']
  // 'PLAIN TEXT'                 -> ['PLAIN TEXT']
  // NOTE: a test suite is verifying these cases: SafeHTMLSubstituteTests
  const chunks = locale.split(SPLIT_REGEX)

  // extract the 'PRE' chunk
  addPlainText(chunks.shift())

  while (chunks.length) {
    // each batch consists of three chunks: ['0', 'INNER', 'POST']
    const [idx, innerChunk, intermediateChunk] = chunks.splice(0, 3)

    const component = components[idx]
    const componentName =
      typeof component === 'string' ? component : component.name
    // pug is doing any necessary escaping on attribute values
    const attributes = (component.attrs && pug.attrs(component.attrs)) || ''
    output.push(
      `<${componentName + attributes}>`,
      ...render(innerChunk, components),
      `</${componentName}>`
    )
    addPlainText(intermediateChunk)
  }
  return output.join('')
}

export default {
  SPLIT_REGEX,
  render,
}
