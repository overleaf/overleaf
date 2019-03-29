/* eslint-disable
    max-len,
    no-return-assign,
    no-throw-literal,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['ace/ace'], function() {
  let UndoManager
  const { Range } = ace.require('ace/range')
  const { EditSession } = ace.require('ace/edit_session')
  const Doc = ace.require('ace/document').Document

  return (UndoManager = class UndoManager {
    constructor($scope, editor) {
      this.$scope = $scope
      this.editor = editor
      this.$scope.undo = { show_remote_warning: false }

      this.reset()

      this.editor.on('changeSession', e => {
        this.reset()
        this.session = e.session
        return e.session.setUndoManager(this)
      })
    }

    showUndoConflictWarning() {
      this.$scope.$apply(() => {
        return (this.$scope.undo.show_remote_warning = true)
      })

      return setTimeout(() => {
        return this.$scope.$apply(() => {
          return (this.$scope.undo.show_remote_warning = false)
        })
      }, 4000)
    }

    reset() {
      this.firstUpdate = true
      this.undoStack = []
      return (this.redoStack = [])
    }

    execute(options) {
      let newDeltaSet
      if (this.firstUpdate) {
        // The first update we receive is Ace setting the document, which we should
        // ignore
        this.firstUpdate = false
        return
      }
      const aceDeltaSets = options.args[0]
      if (aceDeltaSets == null) {
        return
      }
      this.session = options.args[1]

      // We need to split the delta sets into local or remote groups before pushing onto
      // the undo stack, since these are treated differently.
      const splitDeltaSets = []
      let currentDeltaSet = null // Make global to this function
      ;(newDeltaSet = function() {
        currentDeltaSet = { group: 'doc', deltas: [] }
        return splitDeltaSets.push(currentDeltaSet)
      })()
      const currentRemoteState = null

      for (var deltaSet of Array.from(aceDeltaSets || [])) {
        if (deltaSet.group === 'doc') {
          // ignore code folding etc.
          for (let delta of Array.from(deltaSet.deltas)) {
            if (
              currentDeltaSet.remote != null &&
              currentDeltaSet.remote !== !!delta.remote
            ) {
              newDeltaSet()
            }
            currentDeltaSet.deltas.push(delta)
            currentDeltaSet.remote = !!delta.remote
          }
        }
      }

      // The lines are currently as they are after applying all these deltas, but to turn into simple deltas,
      // we need the lines before each delta group.
      let docLines = this.session.getDocument().getAllLines()
      docLines = this._revertAceDeltaSetsOnDocLines(aceDeltaSets, docLines)
      for (deltaSet of Array.from(splitDeltaSets)) {
        var simpleDeltaSet
        ;({ simpleDeltaSet, docLines } = this._aceDeltaSetToSimpleDeltaSet(
          deltaSet,
          docLines
        ))
        const frame = {
          deltaSets: [simpleDeltaSet],
          remote: deltaSet.remote
        }
        this.undoStack.push(frame)
      }
      return (this.redoStack = [])
    }

    undo(dontSelect) {
      // We rely on the doclines being in sync with the undo stack, so make sure
      // any pending undo deltas are processed.
      this.session.$syncInformUndoManager()

      const localUpdatesMade = this._shiftLocalChangeToTopOfUndoStack()
      if (!localUpdatesMade) {
        return
      }

      const update = this.undoStack.pop()
      if (update == null) {
        return
      }

      if (update.remote) {
        this.showUndoConflictWarning()
      }

      const lines = this.session.getDocument().getAllLines()
      const linesBeforeDelta = this._revertSimpleDeltaSetsOnDocLines(
        update.deltaSets,
        lines
      )
      const deltaSets = this._simpleDeltaSetsToAceDeltaSets(
        update.deltaSets,
        linesBeforeDelta
      )
      const selectionRange = this.session.undoChanges(deltaSets, dontSelect)
      this.redoStack.push(update)
      return selectionRange
    }

    redo(dontSelect) {
      const update = this.redoStack.pop()
      if (update == null) {
        return
      }
      const lines = this.session.getDocument().getAllLines()
      const deltaSets = this._simpleDeltaSetsToAceDeltaSets(
        update.deltaSets,
        lines
      )
      const selectionRange = this.session.redoChanges(deltaSets, dontSelect)
      this.undoStack.push(update)
      return selectionRange
    }

    _shiftLocalChangeToTopOfUndoStack() {
      const head = []
      let localChangeExists = false
      while (this.undoStack.length > 0) {
        const update = this.undoStack.pop()
        head.unshift(update)
        if (!update.remote) {
          localChangeExists = true
          break
        }
      }

      if (!localChangeExists) {
        this.undoStack = this.undoStack.concat(head)
        return false
      } else {
        // Undo stack looks like undoStack ++ reorderedhead ++ head
        // Reordered head starts of empty and consumes entries from head
        // while keeping the localChange at the top for as long as it can
        let localChange = head.shift()
        const reorderedHead = [localChange]
        while (head.length > 0) {
          const remoteChange = head.shift()
          localChange = reorderedHead.pop()
          const result = this._swapSimpleDeltaSetsOrder(
            localChange.deltaSets,
            remoteChange.deltaSets
          )
          if (result != null) {
            remoteChange.deltaSets = result[0]
            localChange.deltaSets = result[1]
            reorderedHead.push(remoteChange)
            reorderedHead.push(localChange)
          } else {
            reorderedHead.push(localChange)
            reorderedHead.push(remoteChange)
            break
          }
        }
        this.undoStack = this.undoStack.concat(reorderedHead).concat(head)
        return true
      }
    }

    _swapSimpleDeltaSetsOrder(firstDeltaSets, secondDeltaSets) {
      const newFirstDeltaSets = this._copyDeltaSets(firstDeltaSets)
      const newSecondDeltaSets = this._copyDeltaSets(secondDeltaSets)
      for (let firstDeltaSet of Array.from(
        newFirstDeltaSets.slice(0).reverse()
      )) {
        for (let firstDelta of Array.from(
          firstDeltaSet.deltas.slice(0).reverse()
        )) {
          for (let secondDeltaSet of Array.from(newSecondDeltaSets)) {
            for (let secondDelta of Array.from(secondDeltaSet.deltas)) {
              const success = this._swapSimpleDeltaOrderInPlace(
                firstDelta,
                secondDelta
              )
              if (!success) {
                return null
              }
            }
          }
        }
      }
      return [newSecondDeltaSets, newFirstDeltaSets]
    }

    _copyDeltaSets(deltaSets) {
      const newDeltaSets = []
      for (let deltaSet of Array.from(deltaSets)) {
        const newDeltaSet = {
          deltas: [],
          group: deltaSet.group
        }
        newDeltaSets.push(newDeltaSet)
        for (let delta of Array.from(deltaSet.deltas)) {
          const newDelta = { position: delta.position }
          if (delta.insert != null) {
            newDelta.insert = delta.insert
          }
          if (delta.remove != null) {
            newDelta.remove = delta.remove
          }
          newDeltaSet.deltas.push(newDelta)
        }
      }
      return newDeltaSets
    }

    _swapSimpleDeltaOrderInPlace(firstDelta, secondDelta) {
      const result = this._swapSimpleDeltaOrder(firstDelta, secondDelta)
      if (result == null) {
        return false
      }
      firstDelta.position = result[1].position
      secondDelta.position = result[0].position
      return true
    }

    _swapSimpleDeltaOrder(firstDelta, secondDelta) {
      if (firstDelta.insert != null && secondDelta.insert != null) {
        if (
          secondDelta.position >=
          firstDelta.position + firstDelta.insert.length
        ) {
          secondDelta.position -= firstDelta.insert.length
          return [secondDelta, firstDelta]
        } else if (secondDelta.position > firstDelta.position) {
          return null
        } else {
          firstDelta.position += secondDelta.insert.length
          return [secondDelta, firstDelta]
        }
      } else if (firstDelta.remove != null && secondDelta.remove != null) {
        if (secondDelta.position >= firstDelta.position) {
          secondDelta.position += firstDelta.remove.length
          return [secondDelta, firstDelta]
        } else if (
          secondDelta.position + secondDelta.remove.length >
          firstDelta.position
        ) {
          return null
        } else {
          firstDelta.position -= secondDelta.remove.length
          return [secondDelta, firstDelta]
        }
      } else if (firstDelta.insert != null && secondDelta.remove != null) {
        if (
          secondDelta.position >=
          firstDelta.position + firstDelta.insert.length
        ) {
          secondDelta.position -= firstDelta.insert.length
          return [secondDelta, firstDelta]
        } else if (
          secondDelta.position + secondDelta.remove.length >
          firstDelta.position
        ) {
          return null
        } else {
          firstDelta.position -= secondDelta.remove.length
          return [secondDelta, firstDelta]
        }
      } else if (firstDelta.remove != null && secondDelta.insert != null) {
        if (secondDelta.position >= firstDelta.position) {
          secondDelta.position += firstDelta.remove.length
          return [secondDelta, firstDelta]
        } else {
          firstDelta.position += secondDelta.insert.length
          return [secondDelta, firstDelta]
        }
      } else {
        throw 'Unknown delta types'
      }
    }

    _applyAceDeltasToDocLines(deltas, docLines) {
      const doc = new Doc(docLines.join('\n'))
      doc.applyDeltas(deltas)
      return doc.getAllLines()
    }

    _revertAceDeltaSetsOnDocLines(deltaSets, docLines) {
      const session = new EditSession(docLines.join('\n'))
      session.undoChanges(deltaSets)
      return session.getDocument().getAllLines()
    }

    _revertSimpleDeltaSetsOnDocLines(deltaSets, docLines) {
      let doc = docLines.join('\n')
      for (let deltaSet of Array.from(deltaSets.slice(0).reverse())) {
        for (let delta of Array.from(deltaSet.deltas.slice(0).reverse())) {
          if (delta.remove != null) {
            doc =
              doc.slice(0, delta.position) +
              delta.remove +
              doc.slice(delta.position)
          } else if (delta.insert != null) {
            doc =
              doc.slice(0, delta.position) +
              doc.slice(delta.position + delta.insert.length)
          } else {
            throw 'Unknown delta type'
          }
        }
      }
      return doc.split('\n')
    }

    _aceDeltaSetToSimpleDeltaSet(deltaSet, docLines) {
      const simpleDeltas = []
      for (let delta of Array.from(deltaSet.deltas)) {
        simpleDeltas.push(this._aceDeltaToSimpleDelta(delta, docLines))
        docLines = this._applyAceDeltasToDocLines([delta], docLines)
      }
      const simpleDeltaSet = {
        deltas: simpleDeltas,
        group: deltaSet.group
      }
      return { simpleDeltaSet, docLines }
    }

    _simpleDeltaSetsToAceDeltaSets(simpleDeltaSets, docLines) {
      return (() => {
        const result = []
        for (let deltaSet of Array.from(simpleDeltaSets)) {
          let aceDeltas = []
          for (let delta of Array.from(deltaSet.deltas)) {
            const newAceDeltas = this._simpleDeltaToAceDeltas(delta, docLines)
            docLines = this._applyAceDeltasToDocLines(newAceDeltas, docLines)
            aceDeltas = aceDeltas.concat(newAceDeltas)
          }
          result.push({
            deltas: aceDeltas,
            group: deltaSet.group
          })
        }
        return result
      })()
    }

    _aceDeltaToSimpleDelta(aceDelta, docLines) {
      let simpleDelta
      const { start } = aceDelta
      if (start == null) {
        const JSONstringifyWithCycles = function(o) {
          const seen = []
          return JSON.stringify(o, function(k, v) {
            if (typeof v === 'object') {
              if (seen.indexOf(v) >= 0) {
                return '__cycle__'
              }
              seen.push(v)
            }
            return v
          })
        }
        const error = new Error(
          `aceDelta had no start event: ${JSONstringifyWithCycles(aceDelta)}`
        )
        throw error
      }
      const linesBefore = docLines.slice(0, start.row)
      const position =
        linesBefore.join('').length + // full lines
        linesBefore.length + // new line characters
        start.column // partial line
      switch (aceDelta.action) {
        case 'insert':
          simpleDelta = {
            position,
            insert: aceDelta.lines.join('\n')
          }
          break
        case 'remove':
          simpleDelta = {
            position,
            remove: aceDelta.lines.join('\n')
          }
          break
        default:
          throw new Error(`Unknown Ace action: ${aceDelta.action}`)
      }
      return simpleDelta
    }

    _simplePositionToAcePosition(position, docLines) {
      let column = 0
      let row = 0
      for (let line of Array.from(docLines)) {
        if (position > line.length) {
          row++
          position -= (line + '\n').length
        } else {
          column = position
          break
        }
      }
      return { row, column }
    }

    _simpleDeltaToAceDeltas(simpleDelta, docLines) {
      let aceDelta, end
      const { row, column } = this._simplePositionToAcePosition(
        simpleDelta.position,
        docLines
      )

      const lines = (simpleDelta.insert || simpleDelta.remove || '').split('\n')

      const start = { column, row }
      if (lines.length > 1) {
        end = {
          row: row + lines.length - 1,
          column: lines[lines.length - 1].length
        }
      } else {
        end = {
          row,
          column: column + lines[0].length
        }
      }

      if (simpleDelta.insert != null) {
        aceDelta = {
          action: 'insert',
          lines,
          start,
          end
        }
      } else if (simpleDelta.remove != null) {
        aceDelta = {
          action: 'remove',
          lines,
          start,
          end
        }
      } else {
        throw `Unknown simple delta: ${simpleDelta}`
      }

      return [aceDelta]
    }

    _concatSimpleDeltas(deltas) {
      if (deltas.length === 0) {
        return []
      }

      const concattedDeltas = []
      let previousDelta = deltas.shift()
      for (let delta of Array.from(deltas)) {
        if (delta.insert != null && previousDelta.insert != null) {
          if (
            previousDelta.position + previousDelta.insert.length ===
            delta.position
          ) {
            previousDelta = {
              insert: previousDelta.insert + delta.insert,
              position: previousDelta.position
            }
          } else {
            concattedDeltas.push(previousDelta)
            previousDelta = delta
          }
        } else if (delta.remove != null && previousDelta.remove != null) {
          if (previousDelta.position === delta.position) {
            previousDelta = {
              remove: previousDelta.remove + delta.remove,
              position: delta.position
            }
          } else {
            concattedDeltas.push(previousDelta)
            previousDelta = delta
          }
        } else {
          concattedDeltas.push(previousDelta)
          previousDelta = delta
        }
      }
      concattedDeltas.push(previousDelta)

      return concattedDeltas
    }

    hasUndo() {
      return this.undoStack.length > 0
    }
    hasRedo() {
      return this.redoStack.length > 0
    }
  })
})
