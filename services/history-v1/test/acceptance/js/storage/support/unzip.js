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

/**
 * The contents of every entry in a zip, by name.
 *
 * @param {string} pathname
 * @return {Promise<Map<string, Buffer>>}
 */
function getZipEntryContents(pathname) {
  return yauzl.openAsync(pathname, { lazyEntries: true }).then(
    zip =>
      new BPromise((resolve, reject) => {
        const contents = new Map()
        zip.on('entry', entry => {
          zip.openReadStream(entry, (err, stream) => {
            if (err) return reject(err)
            const chunks = []
            stream.on('data', chunk => chunks.push(chunk))
            stream.on('error', reject)
            stream.on('end', () => {
              contents.set(entry.fileName, Buffer.concat(chunks))
              zip.readEntry()
            })
          })
        })
        zip.on('error', reject)
        zip.on('end', () => resolve(contents))
        zip.readEntry()
      })
  )
}

exports.getZipEntries = getZipEntries
exports.getZipEntryContents = getZipEntryContents
