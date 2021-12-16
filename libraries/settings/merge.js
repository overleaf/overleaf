function merge(settings, defaults) {
  for (const [key, value] of Object.entries(settings)) {
    if (typeof value === 'object' && !(value instanceof Array)) {
      defaults[key] = merge(value, defaults[key] || {})
    } else {
      defaults[key] = value
    }
  }
  return defaults
}

module.exports = { merge }
