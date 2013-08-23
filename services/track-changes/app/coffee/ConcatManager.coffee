strInject = (s1, pos, s2) -> s1[...pos] + s2 + s1[pos..]
strRemove = (s1, pos, length) -> s1[...pos] + s1[(pos + length)..]

module.exports = ConcatManager =
	normalizeUpdate: (update) ->
		updates = []
		for op in update.op
			updates.push
				op: [op]
				meta:
					start_ts: update.meta.ts
					end_ts: update.meta.ts
					user_id: update.meta.user_id
		return updates

	compressUpdates: (rawUpdates) ->
		return [] if rawUpdates.length == 0
		firstPass = [rawUpdates.shift()]
		for update in rawUpdates
			lastCompressedUpdate = firstPass.pop()
			if lastCompressedUpdate?
				firstPass = firstPass.concat ConcatManager._concatTwoUpdatesOfTheSameType lastCompressedUpdate, update
			else
				firstPass.push rawUpdate

		return [] if firstPass.length == 0
		secondPass = [firstPass.shift()]
		for update in firstPass
			lastCompressedUpdate = secondPass.pop()
			if lastCompressedUpdate?
				secondPass = secondPass.concat ConcatManager._cancelOppositeInsertsAndDeletes lastCompressedUpdate, update
			else
				secondPass.push update

		return secondPass

	MAX_TIME_BETWEEN_UPDATES: oneMinute = 60 * 1000

	_concatTwoUpdatesOfTheSameType: (firstUpdate, secondUpdate) ->
		firstUpdate =
			op: firstUpdate.op
			meta:
				user_id:  firstUpdate.meta.user_id or null
				start_ts: firstUpdate.meta.start_ts or firstUpdate.meta.ts
				end_ts:   firstUpdate.meta.end_ts   or firstUpdate.meta.ts
		secondUpdate =
			op: secondUpdate.op
			meta:
				user_id:  secondUpdate.meta.user_id or null
				start_ts: secondUpdate.meta.start_ts or secondUpdate.meta.ts
				end_ts:   secondUpdate.meta.end_ts   or secondUpdate.meta.ts

		if firstUpdate.meta.user_id != secondUpdate.meta.user_id
			return [firstUpdate, secondUpdate]

		if secondUpdate.meta.start_ts - firstUpdate.meta.end_ts > ConcatManager.MAX_TIME_BETWEEN_UPDATES
			return [firstUpdate, secondUpdate]

		firstOp = firstUpdate.op[0]
		secondOp = secondUpdate.op[0]
		# Two inserts
		if firstOp.i? and secondOp.i? and firstOp.p <= secondOp.p <= (firstOp.p + firstOp.i.length)
			return [
				meta:
					start_ts: firstUpdate.meta.start_ts
					end_ts:   secondUpdate.meta.end_ts
					user_id:  firstUpdate.meta.user_id
				op: [
					p: firstOp.p
					i: strInject(firstOp.i, secondOp.p - firstOp.p, secondOp.i)
				]
			]
		# Two deletes
		else if firstOp.d? and secondOp.d? and secondOp.p <= firstOp.p <= (secondOp.p + secondOp.d.length)
			return [
				meta:
					start_ts: firstUpdate.meta.start_ts
					end_ts:   secondUpdate.meta.end_ts
					user_id:  firstUpdate.meta.user_id
				op: [
					p: secondOp.p
					d: strInject(secondOp.d, firstOp.p - secondOp.p, firstOp.d)
				]
			]
		else
			return [firstUpdate, secondUpdate]

	_cancelOppositeInsertsAndDeletes: (firstUpdate, secondUpdate) ->
		firstUpdate =
			op: firstUpdate.op
			meta:
				user_id:  firstUpdate.meta.user_id or null
				start_ts: firstUpdate.meta.start_ts or firstUpdate.meta.ts
				end_ts:   firstUpdate.meta.end_ts   or firstUpdate.meta.ts
		secondUpdate =
			op: secondUpdate.op
			meta:
				user_id:  secondUpdate.meta.user_id or null
				start_ts: secondUpdate.meta.start_ts or secondUpdate.meta.ts
				end_ts:   secondUpdate.meta.end_ts   or secondUpdate.meta.ts

		if firstUpdate.meta.user_id != secondUpdate.meta.user_id
			return [firstUpdate, secondUpdate]

		if secondUpdate.meta.start_ts - firstUpdate.meta.end_ts > ConcatManager.MAX_TIME_BETWEEN_UPDATES
			return [firstUpdate, secondUpdate]

		firstOp = firstUpdate.op[0]
		secondOp = secondUpdate.op[0]

		# An insert and then a delete
		if firstOp.i? and secondOp.d? and firstOp.p <= secondOp.p <= (firstOp.p + firstOp.i.length)
			offset = secondOp.p - firstOp.p
			insertedText = firstOp.i.slice(offset, offset + secondOp.d.length)
			if insertedText == secondOp.d
				insert = strRemove(firstOp.i, offset, secondOp.d.length)
				return [] if insert == ""
				return [
					meta:
						start_ts: firstUpdate.meta.start_ts
						end_ts:   secondUpdate.meta.end_ts
						user_id:  firstUpdate.meta.user_id
					op: [
						p: firstOp.p
						i: insert
					]
				]
			else
				# This shouldn't be possible!
				return [firstUpdate, secondUpdate]
		else if firstOp.d? and secondOp.i? and firstOp.p  == secondOp.p
			offset = firstOp.d.indexOf(secondOp.i)
			if offset == -1
				return [firstUpdate, secondUpdate]
			headD = firstOp.d.slice(0, offset)
			inserted = firstOp.d.slice(offset, secondOp.i.length)
			tailD = firstOp.d.slice(offset + secondOp.i.length)
			headP = firstOp.p
			tailP = firstOp.p + secondOp.i.length
			updates = []
			if headD != ""
				updates.push
					meta:
						start_ts: firstUpdate.meta.start_ts
						end_ts:   secondUpdate.meta.end_ts
						user_id:  firstUpdate.meta.user_id
					op: [
						p: headP
						d: headD
					]
			if tailD != ""
				updates.push
					meta:
						start_ts: firstUpdate.meta.start_ts
						end_ts:   secondUpdate.meta.end_ts
						user_id:  firstUpdate.meta.user_id
					op: [
						p: tailP
						d: tailD
					]
			if updates.length == 2
				updates[0].meta.start_ts = updates[0].meta.end_ts = firstUpdate.meta.start_ts
				updates[1].meta.start_ts = updates[1].meta.end_ts = secondUpdate.meta.end_ts
			return updates

		else
			return [firstUpdate, secondUpdate]

