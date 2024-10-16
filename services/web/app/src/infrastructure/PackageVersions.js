const version = {
  mathjax: '3.2.2',
  dictionaries: '0.0.3',
}

module.exports = {
  version,

  lib(name) {
    if (version[name] != null) {
      return `${name}-${version[name]}`
    } else {
      return `${name}`
    }
  },
}
