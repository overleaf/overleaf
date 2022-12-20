// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import fs from 'node:fs'
import Path from 'node:path'
import { promisify } from 'node:util'
import LRU from 'lru-cache'
import logger from '@overleaf/logger'
import settings from '@overleaf/settings'
import OError from '@overleaf/o-error'
import { ASpellWorkerPool } from './ASpellWorkerPool.js'

let ASPELL_TIMEOUT = 10000

const OneMinute = 60 * 1000
const opts = { max: 10000, maxAge: OneMinute * 60 * 10 }
const cache = new LRU(opts)

const cacheFsPath = Path.resolve(settings.cacheDir, 'spell.cache')
const cacheFsPathTmp = cacheFsPath + '.tmp'

const WorkerPool = new ASpellWorkerPool()

// load any existing cache
try {
  const oldCache = fs.readFileSync(cacheFsPath)
  cache.load(JSON.parse(oldCache))
} catch (error) {
  logger.debug(
    OError.tag(error, 'could not load the cache file', { cacheFsPath })
  )
}

let cacheDumpInterval
export function startCacheDump() {
  // write the cache every 30 minutes
  cacheDumpInterval = setInterval(function () {
    const dump = JSON.stringify(cache.dump())
    return fs.writeFile(cacheFsPathTmp, dump, function (err) {
      if (err != null) {
        logger.debug(OError.tag(err, 'error writing cache file'))
        fs.unlink(cacheFsPathTmp, () => {})
      } else {
        fs.rename(cacheFsPathTmp, cacheFsPath, err => {
          if (err) {
            logger.error(OError.tag(err, 'error renaming cache file'))
          } else {
            logger.debug({ len: dump.length, cacheFsPath }, 'wrote cache file')
          }
        })
      }
    })
  }, 30 * OneMinute)
}

export function stopCacheDump() {
  clearInterval(cacheDumpInterval)
}

class ASpellRunner {
  checkWords(language, words, callback) {
    if (callback == null) {
      callback = () => {}
    }
    return this.runAspellOnWords(language, words, (error, output) => {
      if (error != null) {
        return callback(OError.tag(error))
      }
      // output = @removeAspellHeader(output)
      const suggestions = this.getSuggestions(language, output)
      const results = []
      let hits = 0
      const addToCache = {}
      for (let i = 0; i < words.length; i++) {
        const word = words[i]
        const key = language + ':' + word
        const cached = cache.get(key)
        if (cached != null) {
          hits++
          if (cached === true) {
            // valid word, no need to do anything
            continue
          } else {
            results.push({ index: i, suggestions: cached })
          }
        } else {
          if (suggestions[key] != null) {
            addToCache[key] = suggestions[key]
            results.push({ index: i, suggestions: suggestions[key] })
          } else {
            // a valid word, but uncached
            addToCache[key] = true
          }
        }
      }

      // update the cache after processing all words, to avoid cache
      // changing while we use it
      for (const k in addToCache) {
        const v = addToCache[k]
        cache.set(k, v)
      }

      logger.debug(
        {
          hits,
          total: words.length,
          hitrate: (hits / words.length).toFixed(2),
        },
        'cache hit rate'
      )
      return callback(null, results)
    })
  }

  getSuggestions(language, output) {
    const lines = output.split('\n')
    const suggestions = {}
    for (const line of Array.from(lines)) {
      let parts, word
      if (line[0] === '&') {
        // Suggestions found
        parts = line.split(' ')
        if (parts.length > 1) {
          word = parts[1]
          const suggestionsString = line.slice(line.indexOf(':') + 2)
          suggestions[language + ':' + word] = suggestionsString.split(', ')
        }
      } else if (line[0] === '#') {
        // No suggestions
        parts = line.split(' ')
        if (parts.length > 1) {
          word = parts[1]
          suggestions[language + ':' + word] = []
        }
      }
    }
    return suggestions
  }

  // removeAspellHeader: (output) -> output.slice(1)

  runAspellOnWords(language, words, callback) {
    // send words to aspell, get back string output for those words
    // find a free pipe for the language (or start one)
    // send the words down the pipe
    // send an END marker that will generate a "*" line in the output
    // when the output pipe receives the "*" return the data sofar and reset the pipe to be available
    //
    // @open(language)
    // @captureOutput(callback)
    // @setTerseMode()
    // start = new Date()

    if (callback == null) {
      callback = () => {}
    }
    const newWord = {}
    for (const word of Array.from(words)) {
      if (!newWord[word] && !cache.has(language + ':' + word)) {
        newWord[word] = true
      }
    }
    words = Object.keys(newWord)

    if (words.length) {
      return WorkerPool.check(language, words, ASPELL_TIMEOUT, callback)
    } else {
      return callback(null, '')
    }
  }
}

// The description of how to call aspell from another program can be found here:
// http://aspell.net/man-html/Through-A-Pipe.html
export function checkWords(language, words, callback) {
  if (callback == null) {
    callback = () => {}
  }
  const runner = new ASpellRunner()
  return runner.checkWords(language, words, callback)
}

export const promises = {
  checkWords: promisify(checkWords),
}

// for tests
export function setTimeout(timeout) {
  ASPELL_TIMEOUT = timeout
}
