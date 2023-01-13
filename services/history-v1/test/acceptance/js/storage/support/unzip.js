'use strict'

const BPromise = require('bluebird')
const yauzl = BPromise.promisifyAll(require('yauzl'))

function getZipEntries(pathname) {
  function readEntries(zip) {
    return new BPromise((resolve, reject) => {
      const entries = []
      zip.on('entry', entry => {
        entries.push(entry)
      })
      zip.on('error', reject)
      zip.on('end', () => {
        resolve(entries)
      })
    })
  }
  return yauzl.openAsync(pathname).then(readEntries)
}

exports.getZipEntries = getZipEntries
