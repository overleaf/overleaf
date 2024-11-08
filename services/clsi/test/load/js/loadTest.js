// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const request = require('request')
const Settings = require('@overleaf/settings')
const async = require('async')
const fs = require('node:fs')
const _ = require('lodash')
const concurentCompiles = 5
const totalCompiles = 50

const buildUrl = path =>
  `http://${Settings.internal.clsi.host}:${Settings.internal.clsi.port}/${path}`

const mainTexContent = fs.readFileSync('./bulk.tex', 'utf-8')

const compileTimes = []
let failedCount = 0

const getAverageCompileTime = function () {
  const totalTime = _.reduce(compileTimes, (sum, time) => sum + time, 0)
  return totalTime / compileTimes.length
}

const makeRequest = function (compileNumber, callback) {
  let bulkBodyCount = 7
  let bodyContent = ''
  while (--bulkBodyCount) {
    bodyContent = bodyContent += mainTexContent
  }

  const startTime = new Date()
  return request.post(
    {
      url: buildUrl(`project/loadcompile-${compileNumber}/compile`),
      json: {
        compile: {
          resources: [
            {
              path: 'main.tex',
              content: `\
\\documentclass{article}
\\begin{document}
${bodyContent}
\\end{document}\
`,
            },
          ],
        },
      },
    },
    (err, response, body) => {
      if (err != null) {
        failedCount++
        return callback(new Error(`compile ${compileNumber} failed`))
      }
      if (response.statusCode !== 200) {
        failedCount++
        return callback(new Error(`compile ${compileNumber} failed`))
      }
      const totalTime = new Date() - startTime
      console.log(totalTime + 'ms')
      compileTimes.push(totalTime)
      return callback(err)
    }
  )
}

const jobs = _.map(
  __range__(1, totalCompiles, true),
  i => cb => makeRequest(i, cb)
)

const startTime = new Date()
async.parallelLimit(jobs, concurentCompiles, err => {
  if (err != null) {
    console.error(err)
  }
  console.log(`total time taken = ${(new Date() - startTime) / 1000}s`)
  console.log(`total compiles = ${totalCompiles}`)
  console.log(`concurent compiles = ${concurentCompiles}`)
  console.log(`average time = ${getAverageCompileTime() / 1000}s`)
  console.log(`max time = ${_.max(compileTimes) / 1000}s`)
  console.log(`min time = ${_.min(compileTimes) / 1000}s`)
  return console.log(`total failures = ${failedCount}`)
})

function __range__(left, right, inclusive) {
  const range = []
  const ascending = left < right
  const end = !inclusive ? right : ascending ? right + 1 : right - 1
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i)
  }
  return range
}
