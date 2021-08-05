/* eslint-disable
    no-unmodified-loop-condition,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ProjectIterator
const Heap = require('heap')

module.exports =
  ProjectIterator =
  ProjectIterator =
    class ProjectIterator {
      constructor(packs, before, getPackByIdFn) {
        this.before = before
        this.getPackByIdFn = getPackByIdFn
        const byEndTs = (a, b) =>
          b.meta.end_ts - a.meta.end_ts || a.fromIndex - b.fromIndex
        this.packs = packs.slice().sort(byEndTs)
        this.queue = new Heap(byEndTs)
      }

      next(callback) {
        //  what's up next
        // console.log ">>> top item", iterator.packs[0]
        const iterator = this
        const { before } = this
        const { queue } = iterator
        const opsToReturn = []
        let nextPack = iterator.packs[0]
        let lowWaterMark =
          (nextPack != null ? nextPack.meta.end_ts : undefined) || 0
        let nextItem = queue.peek()

        // console.log "queue empty?", queue.empty()
        // console.log "nextItem", nextItem
        // console.log "nextItem.meta.end_ts", nextItem?.meta.end_ts
        // console.log "lowWaterMark", lowWaterMark

        while (
          before != null &&
          (nextPack != null ? nextPack.meta.start_ts : undefined) > before
        ) {
          // discard pack that is outside range
          iterator.packs.shift()
          nextPack = iterator.packs[0]
          lowWaterMark =
            (nextPack != null ? nextPack.meta.end_ts : undefined) || 0
        }

        if (
          (queue.empty() ||
            (nextItem != null ? nextItem.meta.end_ts : undefined) <=
              lowWaterMark) &&
          nextPack != null
        ) {
          // retrieve the next pack and populate the queue
          return this.getPackByIdFn(
            nextPack.project_id,
            nextPack.doc_id,
            nextPack._id,
            function (err, pack) {
              if (err != null) {
                return callback(err)
              }
              iterator.packs.shift() // have now retrieved this pack, remove it
              // console.log "got pack", pack
              for (const op of Array.from(pack.pack)) {
                // console.log "adding op", op
                if (before == null || op.meta.end_ts < before) {
                  op.doc_id = nextPack.doc_id
                  op.project_id = nextPack.project_id
                  queue.push(op)
                }
              }
              // now try again
              return iterator.next(callback)
            }
          )
        }

        // console.log "nextItem", nextItem, "lowWaterMark", lowWaterMark
        while (
          nextItem != null &&
          (nextItem != null ? nextItem.meta.end_ts : undefined) > lowWaterMark
        ) {
          opsToReturn.push(nextItem)
          queue.pop()
          nextItem = queue.peek()
        }

        // console.log "queue empty?", queue.empty()
        // console.log "nextPack", nextPack?

        if (queue.empty() && nextPack == null) {
          // got everything
          iterator._done = true
        }

        return callback(null, opsToReturn)
      }

      done() {
        return this._done
      }
    }
