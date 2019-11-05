const fs = require('fs')
const path = require('path')

const MODULES_PATH = path.join(__dirname, './')

const entryPoints = []
if (fs.existsSync(MODULES_PATH)) {
  fs.readdirSync(MODULES_PATH).reduce((acc, module) => {
    const entryPath = path.join(
      MODULES_PATH,
      module,
      '/frontend/js/main/index.js'
    )
    if (fs.existsSync(entryPath)) {
      acc.push(entryPath)
    }
    return acc
  }, entryPoints)
}

module.exports = function() {
  return {
    code: `define(['${entryPoints.join("', '")}'], function() {})`
  }
}
