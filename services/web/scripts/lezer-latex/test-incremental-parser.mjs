import { parser } from '../../frontend/js/features/source-editor/lezer-latex/latex.mjs'

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TreeFragment } from '@lezer/common'
import minimist from 'minimist'
import { seed, random } from './random.mjs'

const argv = minimist(process.argv.slice(2))
const NUMBER_OF_OPS = argv.ops || 1000
const CSV_OUTPUT = argv.csv || false
const SEED = argv.seed

if (SEED) {
  seed(SEED)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const examplesDir = path.join(
  __dirname,
  '../../test/unit/src/LezerLatex/examples'
)

const folder = examplesDir
for (const file of fs.readdirSync(folder).sort()) {
  if (!/\.tex$/.test(file)) continue
  const name = /^[^.]*/.exec(file)[0]
  const content = fs.readFileSync(path.join(folder, file), 'utf8')
  runPerformanceTests(name, content)
}

function runPerformanceTests(name, content) {
  const insertEnd = writeTextAt(
    content,
    content.length,
    content.substring(0, NUMBER_OF_OPS)
  )
  const insertBeginning = writeTextAt(
    content,
    0,
    content.substring(0, NUMBER_OF_OPS)
  )
  const insertMiddle = writeTextAt(
    content,
    Math.floor(content.length / 2),
    content.substring(0, NUMBER_OF_OPS)
  )
  const randomDelete = randomDeletions(content, NUMBER_OF_OPS)
  const middleDelete = deletionsFromMiddle(content, NUMBER_OF_OPS)
  const randomInsert = randomInsertions(content, NUMBER_OF_OPS)

  if (CSV_OUTPUT) {
    console.log(
      [
        name,
        insertBeginning.average,
        insertMiddle.average,
        insertEnd.average,
        randomInsert.average,
        randomDelete.average,
        middleDelete.average,
        content.length,
      ].join(',')
    )
  } else {
    console.log({
      name,
      insertAtEnd: insertEnd.average,
      insertAtBeginning: insertBeginning.average,
      insertAtMiddle: insertMiddle.average,
      randomDelete: randomDelete.average,
      middleDelete: middleDelete.average,
      randomInsert: randomInsert.average,
      docLength: content.length,
    })
  }
}

function timedChanges(document, changes, changeFn) {
  let totalParseTime = 0

  // Do a fresh parse to get TreeFragments
  const initialTree = parser.parse(document)
  let fragments = TreeFragment.addTree(initialTree)
  let currentDoc = document

  for (let i = 0; i < changes; ++i) {
    const change = changeFn(currentDoc, i)
    currentDoc = change.text
    // Do a timed parse
    const start = performance.now()
    fragments = TreeFragment.applyChanges(fragments, [change.range])
    const tree = parser.parse(currentDoc, fragments)
    fragments = TreeFragment.addTree(tree, fragments)
    const end = performance.now()
    totalParseTime += end - start
  }
  return {
    total: totalParseTime,
    average: totalParseTime / changes,
    ops: changes,
    fragments: fragments.length,
  }
}

// Write and parse after every character insertion
function writeTextAt(document, position, text) {
  return timedChanges(document, text.length, (currentDoc, index) =>
    insertAt(currentDoc, position + index, text[index])
  )
}

function randomInsertions(document, num) {
  return timedChanges(document, num, currentDoc =>
    insertAt(currentDoc, Math.floor(random() * currentDoc.length), 'a')
  )
}

function randomDeletions(document, num) {
  return timedChanges(document, num, currentDoc =>
    deleteAt(currentDoc, Math.floor(random() * currentDoc.length), 1)
  )
}

function deletionsFromMiddle(document, num) {
  const deletionPoint = Math.floor(document.length / 2)
  const deletions = Math.min(num, deletionPoint - 1)
  return timedChanges(document, deletions, (currentDoc, index) =>
    deleteAt(currentDoc, deletionPoint - index, 1)
  )
}

function insertAt(document, position, text) {
  const start = document.substring(0, position)
  const end = document.substring(position)

  return {
    text: start + text + end,
    range: {
      fromA: position,
      toA: position,
      fromB: position,
      toB: position + text.length,
    },
  }
}

function deleteAt(document, position, length = 1) {
  const start = document.substring(0, position)
  const end = document.substring(position + length)

  return {
    text: start + end,
    range: {
      fromA: position,
      toA: position + length,
      fromB: position,
      toB: position,
    },
  }
}
