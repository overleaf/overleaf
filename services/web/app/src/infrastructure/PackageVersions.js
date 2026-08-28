const version = {
  mathjax: '4.1.2',
  dictionaries: '0.0.3',
  mathlive: '0.110.0',
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
