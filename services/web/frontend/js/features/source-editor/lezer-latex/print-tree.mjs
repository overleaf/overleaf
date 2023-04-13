// from https://gist.github.com/msteen/e4828fbf25d6efef73576fc43ac479d2
// https://discuss.codemirror.net/t/whats-the-best-to-test-and-debug-grammars/2542/5
// MIT License
//
// Copyright (c) 2021 Matthijs Steen
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
import { Text } from '@codemirror/state'
import { Tree, TreeCursor } from '@lezer/common'

class StringInput {
  constructor(input) {
    this.input = input
    this.lineChunks = false
  }

  get length() {
    return this.input.length
  }

  chunk(from) {
    return this.input.slice(from)
  }

  read(from, to) {
    return this.input.slice(from, to)
  }
}

function cursorNode({ type, from, to }, isLeaf = false) {
  return { type, from, to, isLeaf }
}
function traverseTree(
  cursor,
  {
    from = -Infinity,
    to = Infinity,
    includeParents = false,
    beforeEnter,
    onEnter,
    onLeave,
  }
) {
  if (!(cursor instanceof TreeCursor))
    cursor = cursor instanceof Tree ? cursor.cursor() : cursor.cursor()
  for (;;) {
    let node = cursorNode(cursor)
    let leave = false
    if (node.from <= to && node.to >= from) {
      const enter =
        !node.type.isAnonymous &&
        (includeParents || (node.from >= from && node.to <= to))
      if (enter && beforeEnter) beforeEnter(cursor)
      node.isLeaf = !cursor.firstChild()
      if (enter) {
        leave = true
        if (onEnter(node) === false) return
      }
      if (!node.isLeaf) continue
    }
    for (;;) {
      node = cursorNode(cursor, node.isLeaf)
      if (leave && onLeave) if (onLeave(node) === false) return
      leave = cursor.type.isAnonymous
      node.isLeaf = false
      if (cursor.nextSibling()) break
      if (!cursor.parent()) return
      leave = true
    }
  }
}
function isChildOf(child, parent) {
  return (
    child.from >= parent.from &&
    child.from <= parent.to &&
    child.to <= parent.to &&
    child.to >= parent.from
  )
}
function validatorTraversal(input, { fullMatch = true } = {}) {
  if (typeof input === 'string') input = new StringInput(input)
  const state = {
    valid: true,
    parentNodes: [],
    lastLeafTo: 0,
  }
  return {
    state,
    traversal: {
      onEnter(node) {
        state.valid = true
        if (!node.isLeaf) state.parentNodes.unshift(node)
        if (node.from > node.to || node.from < state.lastLeafTo) {
          state.valid = false
        } else if (node.isLeaf) {
          if (
            state.parentNodes.length &&
            !isChildOf(node, state.parentNodes[0])
          )
            state.valid = false
          state.lastLeafTo = node.to
        } else {
          if (state.parentNodes.length) {
            if (!isChildOf(node, state.parentNodes[0])) state.valid = false
          } else if (
            fullMatch &&
            (node.from !== 0 || node.to !== input.length)
          ) {
            state.valid = false
          }
        }
      },
      onLeave(node) {
        if (!node.isLeaf) state.parentNodes.shift()
      },
    },
  }
}

let Color
;(function (Color) {
  Color[(Color.Red = 31)] = 'Red'
  Color[(Color.Green = 32)] = 'Green'
  Color[(Color.Yellow = 33)] = 'Yellow'
})(Color || (Color = {}))

function colorize(value, color) {
  return '\u001b[' + color + 'm' + String(value) + '\u001b[39m'
}

function printTree(
  cursor,
  input,
  { from, to, start = 0, includeParents } = {}
) {
  const inp = typeof input === 'string' ? new StringInput(input) : input
  const text = Text.of(inp.read(0, inp.length).split('\n'))
  const state = {
    output: '',
    prefixes: [],
    hasNextSibling: false,
  }
  const validator = validatorTraversal(inp)
  traverseTree(cursor, {
    from,
    to,
    includeParents,
    beforeEnter(cursor) {
      state.hasNextSibling = cursor.nextSibling() && cursor.prevSibling()
    },
    onEnter(node) {
      validator.traversal.onEnter(node)
      const isTop = state.output === ''
      const hasPrefix = !isTop || node.from > 0
      if (hasPrefix) {
        state.output += (!isTop ? '\n' : '') + state.prefixes.join('')
        if (state.hasNextSibling) {
          state.output += ' ├─ '
          state.prefixes.push(' │  ')
        } else {
          state.output += ' └─ '
          state.prefixes.push('    ')
        }
      }
      const hasRange = node.from !== node.to
      state.output +=
        (node.type.isError || !validator.state.valid
          ? colorize('ERROR ' + node.type.name, Color.Red)
          : node.type.name) +
        ' ' +
        (hasRange
          ? '[' +
            colorize(locAt(text, start + node.from), Color.Yellow) +
            '..' +
            colorize(locAt(text, start + node.to), Color.Yellow) +
            ']'
          : colorize(locAt(text, start + node.from), Color.Yellow))
      if (hasRange && node.isLeaf) {
        state.output +=
          ': ' +
          colorize(JSON.stringify(inp.read(node.from, node.to)), Color.Green)
      }
    },
    onLeave(node) {
      validator.traversal.onLeave(node)
      state.prefixes.pop()
    },
  })
  return state.output
}

function locAt(text, pos) {
  const line = text.lineAt(pos)
  return line.number + ':' + (pos - line.from)
}

export function logTree(tree, input, options) {
  console.log(printTree(tree, input, options))
}
