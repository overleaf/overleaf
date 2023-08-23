const version = {
  // Upgrade instructions: https://github.com/overleaf/write_latex/wiki/Upgrading-Ace
  ace: '1.4.12',
  mathjax: '2.7.9',
  'mathjax-3': '3.2.2',
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
