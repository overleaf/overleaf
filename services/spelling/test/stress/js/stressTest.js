/* eslint-disable */
// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS202: Simplify dynamic range loops
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// N requests in parallel
// send P correct words and Q incorrect words
// generate incorrect words by qq+random

import fs from 'node:fs'
import async from 'async'
import request from 'request'

// created with
// aspell -d en dump master | aspell -l en expand | shuf -n 150000 > words.txt
const WORDS = 'words.txt'
const wordlist = fs
  .readFileSync(WORDS)
  .toString()
  .split('\n')
  .filter(w => w.match(/^[a-z]+$/))

const generateCorrectWords = function (n) {
  const words = []
  const N = Math.random() > 0.5 ? wordlist.length : 10
  for (
    let i = 1, end = n, asc = 1 <= end;
    asc ? i <= end : i >= end;
    asc ? i++ : i--
  ) {
    const j = Math.floor(N * Math.random())
    words.push(wordlist[j])
  }
  return words
}

const generateIncorrectWords = function (n) {
  const words = []
  const N = wordlist.length
  for (
    let i = 1, end = n, asc = 1 <= end;
    asc ? i <= end : i >= end;
    asc ? i++ : i--
  ) {
    const j = Math.floor(N * Math.random())
    words.push(`qzxq${wordlist[j]}`)
  }
  return words
}

const makeRequest = function (correctWords, incorrectWords, callback) {
  let i, j, w
  let i1
  let j1
  const correctSet = generateCorrectWords(correctWords)
  const incorrectSet = generateIncorrectWords(incorrectWords)
  correctSet.push('constructor')
  incorrectSet.push('qzxqfoofoofoo')
  const full = correctSet.concat(incorrectSet)
  const bad = []
  for (j = 0, i = j; j < correctSet.length; j++, i = j) {
    w = correctSet[i]
    bad[i] = false
  }
  for (i1 = 0, i = i1; i1 < incorrectSet.length; i1++, i = i1) {
    w = incorrectSet[i]
    bad[i + correctSet.length] = true
  }
  const k = full.length
  full.forEach(function (e, i) {
    let ref
    j = Math.floor(k * Math.random())
    ;[full[i], full[j]] = Array.from([full[j], full[i]])
    return ([bad[i], bad[j]] = Array.from((ref = [bad[j], bad[i]]))), ref
  })
  const expected = []
  for (j1 = 0, i = j1; j1 < bad.length; j1++, i = j1) {
    const tf = bad[i]
    if (tf) {
      expected.push({ index: i, word: full[i] })
    }
  }
  return request.post(
    'http://localhost:3005/user/1/check',
    { json: true, body: { words: full } },
    function (err, req, body) {
      let m
      const { misspellings } = body
      console.log(JSON.stringify({ full, misspellings }))
      if (expected.length !== misspellings.length) {
        let asc, end
        console.log(
          'ERROR: length mismatch',
          expected.length,
          misspellings.length
        )
        console.log(full, bad)
        console.log('expected', expected, 'mispellings', misspellings)
        for (
          i = 0,
            end = Math.max(expected.length, misspellings.length) - 1,
            asc = 0 <= end;
          asc ? i <= end : i >= end;
          asc ? i++ : i--
        ) {
          if (expected[i].index !== misspellings[i].index) {
            console.log(
              'ERROR',
              i,
              expected[i],
              misspellings[i],
              full[misspellings[i].index]
            )
          }
        }
        for (m of Array.from(misspellings)) {
          console.log(full[m.index], '=>', m)
        }
        process.exit()
        callback('error')
      } else {
        for (i = 0; i < body.misspellings.length; i++) {
          m = body.misspellings[i]
          if (m.index !== expected[i].index) {
            console.log('ERROR AT RESULT', i, m, expected[i])
            process.exit()
            callback('error')
          }
        }
      }
      return callback(null, full)
    }
  )
}

const q = async.queue(
  (task, callback) =>
    setTimeout(
      () => makeRequest(task.correct, task.incorrect, callback),
      Math.random() * 100
    ),

  3
)

q.drain(() => console.log('all items have been processed'))

for (let i = 0; i <= 1000; i++) {
  q.push({
    correct: Math.floor(30 * Math.random()) + 1,
    incorrect: Math.floor(3 * Math.random()),
  })
}
// if Math.random() < 0.1
// else
// 	q.push({correct: Math.floor(100*Math.random()) + 1, incorrect: Math.floor(3*Math.random())})
