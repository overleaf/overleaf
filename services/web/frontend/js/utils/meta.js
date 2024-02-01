import _ from 'lodash'

// cache for parsed values
window.metaAttributesCache = window.metaAttributesCache || new Map()

export default function getMeta(name, fallback) {
  if (window.metaAttributesCache.has(name)) {
    return window.metaAttributesCache.get(name)
  }
  const element = document.head.querySelector(`meta[name="${name}"]`)
  if (!element) {
    return fallback
  }
  const plainTextValue = element.content
  let value
  switch (element.dataset.type) {
    case 'boolean':
      // in pug: content=false -> no content field
      // in pug: content=true  -> empty content field
      value = element.hasAttribute('content')
      break
    case 'json':
      if (!plainTextValue) {
        // JSON.parse('') throws
        value = undefined
      } else {
        value = JSON.parse(plainTextValue)
      }
      break
    default:
      value = plainTextValue
  }
  window.metaAttributesCache.set(name, value)
  return value
}

function convertMetaToWindowAttributes() {
  window.data = window.data || {}
  Array.from(document.querySelectorAll('meta[name^="ol-"]'))
    .map(element => element.name)
    // process short labels before long ones:
    // e.g. assign 'foo' before 'foo.bar'
    .sort()
    .forEach(nameWithNamespace => {
      const label = nameWithNamespace.slice('ol-'.length)
      _.set(window, label, getMeta(nameWithNamespace))
      _.set(window.data, label, getMeta(nameWithNamespace))
    })
}
convertMetaToWindowAttributes()
