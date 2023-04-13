import { readFileSync } from 'fs'
import { logTree } from '../../frontend/js/features/source-editor/lezer-latex/print-tree.mjs'
import { parser } from '../../frontend/js/features/source-editor/lezer-latex/latex.mjs'

// Runs the lezer-latex parser on a supplied file, and prints the resulting
// parse tree to stdout
//
// show parse tree:     lezer-latex-run.js test/frontend/shared/lezer-latex/examples/amsmath.tex
// show error summary:  lezer-latex-run.js coverage test/frontend/shared/lezer-latex/examples/amsmath.tex

let files = process.argv.slice(2)
if (!files.length) {
  files = ['test/unit/src/LezerLatex/examples/demo.tex']
}

let coverage = false
if (files[0] === 'coverage') {
  // count errors
  coverage = true
  files.shift()
}

function reportErrorCounts(output) {
  if (coverage) process.stdout.write(output)
}

function parseFile(filename) {
  const text = readFileSync(filename).toString()
  const t0 = process.hrtime()
  const tree = parser.parse(text)
  const dt = process.hrtime(t0)
  const timeTaken = dt[0] + dt[1] * 1e-9
  let errorCount = 0
  let nodeCount = 0
  tree.iterate({
    enter: syntaxNodeRef => {
      nodeCount++
      if (syntaxNodeRef.type.isError) {
        errorCount++
      }
    },
  })
  if (!coverage) logTree(tree, text)
  return { nodeCount, errorCount, timeTaken, bytes: text.length }
}

let totalErrors = 0
let totalTime = 0
let totalBytes = 0
for (const file of files) {
  const { nodeCount, errorCount, timeTaken, bytes } = parseFile(file)
  const errorRate = Math.round((100 * errorCount) / nodeCount)
  totalErrors += errorCount
  totalTime += timeTaken
  totalBytes += bytes
  reportErrorCounts(
    `${errorCount} errors`.padStart(12) +
      `${nodeCount} nodes`.padStart(12) +
      `(${errorRate}%)`.padStart(6) +
      `${(1000 * timeTaken).toFixed(1)} ms`.padStart(8) +
      `${(bytes / 1024).toFixed(1)} KB`.padStart(8) +
      ` ${file}\n`
  )
}
const timeInMilliseconds = 1000 * totalTime
const hundredKBs = totalBytes / (100 * 1024)

reportErrorCounts(
  `\ntotal errors ${totalErrors}, performance ${(
    timeInMilliseconds / hundredKBs
  ).toFixed(1)} ms/100KB \n`
)

if (totalErrors > 0) {
  process.exit(1) // return non-zero exit status for tests
}
