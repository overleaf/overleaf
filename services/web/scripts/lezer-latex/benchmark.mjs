import { parser } from '../../frontend/js/features/source-editor/lezer-latex/latex.mjs'

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import minimist from 'minimist'

const argv = minimist(process.argv.slice(2))
const NUMBER_OF_OPS = argv.ops || 100
const CSV_OUTPUT = argv.csv || false

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const examplesDir = path.join(
  __dirname,
  '../../test/unit/src/LezerLatex/examples'
)

const strictParser = parser.configure({ strict: true }) // throw exception for invalid documents

if (!fs.existsSync(examplesDir)) {
  console.error('No examples directory')
  process.exit()
}

function dumpParserStats(parser) {
  console.log('Parser size:')
  console.dir({
    states: parser.states.length,
    data: parser.data.length,
    goto: parser.goto.length,
  })
}

dumpParserStats(strictParser)

const folder = examplesDir
for (const file of fs.readdirSync(folder).sort()) {
  if (!/\.tex$/.test(file)) continue
  const name = /^[^.]*/.exec(file)[0]
  const content = fs.readFileSync(path.join(folder, file), 'utf8')

  benchmark(name, content)
}

function benchmark(name, content) {
  let timeSum = 0
  try {
    for (let i = 0; i < NUMBER_OF_OPS; ++i) {
      const startTime = performance.now()
      strictParser.parse(content)
      const endTime = performance.now()
      timeSum += endTime - startTime
    }
    const avgTime = timeSum / NUMBER_OF_OPS
    if (CSV_OUTPUT) {
      console.log(`${name},${avgTime.toFixed(2)},${content.length}`)
    } else {
      console.log(
        `${name.padEnd(20)} time to run (ms):\t ${avgTime.toFixed(2)}`
      )
    }
  } catch (error) {
    console.error(`${name.padEnd(20)} ${error}`)
  }
}
