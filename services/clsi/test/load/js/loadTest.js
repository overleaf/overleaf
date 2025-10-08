const { fetchNothing } = require('@overleaf/fetch-utils')
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

const makeRequest = async function (compileNumber) {
  let bulkBodyCount = 7
  let bodyContent = ''
  while (--bulkBodyCount) {
    bodyContent = bodyContent += mainTexContent
  }

  const startTime = new Date()

  try {
    await fetchNothing(
      buildUrl(`project/loadcompile-${compileNumber}/compile`),
      {
        method: 'POST',
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
      }
    )
    const totalTime = new Date() - startTime
    console.log(totalTime + 'ms')
    compileTimes.push(totalTime)
  } catch (error) {
    console.log({ error })
    failedCount++
    throw new Error(`compile ${compileNumber} failed`)
  }
}

const jobs = []
for (let i = 0; i < totalCompiles; i++) {
  jobs.push(() => makeRequest(i))
}

const runJob = (job, _, cb) =>
  job()
    .then(() => cb())
    .catch(err => cb(err))

async function run() {
  const startTime = new Date()
  await async.eachOfLimit(jobs, concurentCompiles, runJob)
  console.log(`total time taken = ${(new Date() - startTime) / 1000}s`)
  console.log(`total compiles = ${totalCompiles}`)
  console.log(`concurent compiles = ${concurentCompiles}`)
  console.log(`average time = ${getAverageCompileTime() / 1000}s`)
  console.log(`max time = ${_.max(compileTimes) / 1000}s`)
  console.log(`min time = ${_.min(compileTimes) / 1000}s`)
  console.log(`total failures = ${failedCount}`)
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
