const version = {
  mathjax: '3.2.2',
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
