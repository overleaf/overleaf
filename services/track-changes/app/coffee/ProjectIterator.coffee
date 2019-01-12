Heap = require "heap"

module.exports = ProjectIterator =

	class ProjectIterator
		constructor: (packs, @before, @getPackByIdFn) ->
			byEndTs = (a,b) -> (b.meta.end_ts - a.meta.end_ts) || (a.fromIndex - b.fromIndex)
			@packs = packs.slice().sort byEndTs
			@queue = new Heap(byEndTs)

		next: (callback) ->
			#  what's up next
			#console.log ">>> top item", iterator.packs[0]
			iterator = this
			before = @before
			queue = iterator.queue
			opsToReturn = []
			nextPack = iterator.packs[0]
			lowWaterMark = nextPack?.meta.end_ts || 0
			nextItem = queue.peek()

			#console.log "queue empty?", queue.empty()
			#console.log "nextItem", nextItem
			#console.log "nextItem.meta.end_ts", nextItem?.meta.end_ts
			#console.log "lowWaterMark", lowWaterMark

			while before? and nextPack?.meta.start_ts > before
				# discard pack that is outside range
				iterator.packs.shift()
				nextPack = iterator.packs[0]
				lowWaterMark = nextPack?.meta.end_ts || 0

			if (queue.empty() or nextItem?.meta.end_ts <= lowWaterMark) and nextPack?
				# retrieve the next pack and populate the queue
				return @getPackByIdFn nextPack.project_id, nextPack.doc_id, nextPack._id, (err, pack) ->
					return callback(err) if err?
					iterator.packs.shift() # have now retrieved this pack, remove it
					#console.log "got pack", pack
					for op in pack.pack when (not before? or op.meta.end_ts < before)
						#console.log "adding op", op
						op.doc_id = nextPack.doc_id
						op.project_id = nextPack.project_id
						queue.push op
					# now try again
					return iterator.next(callback)

			#console.log "nextItem", nextItem, "lowWaterMark", lowWaterMark
			while nextItem? and (nextItem?.meta.end_ts > lowWaterMark)
				opsToReturn.push nextItem
				queue.pop()
				nextItem = queue.peek()

			#console.log "queue empty?", queue.empty()
			#console.log "nextPack", nextPack?

			if queue.empty() and not nextPack? # got everything
				iterator._done = true

			callback(null, opsToReturn)

		done: () ->
			return @_done
