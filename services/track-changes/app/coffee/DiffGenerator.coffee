ConsistencyError = (message) ->
	error = new Error(message)
	error.name = "ConsistencyError"
	error.__proto__ = ConsistencyError.prototype
	return error
ConsistencyError.prototype.__proto__ = Error.prototype

module.exports = DiffGenerator =
	ConsistencyError: ConsistencyError

	rewindUpdate: (content, update) ->
		op = update.op
		if op.i?
			textToBeRemoved = content.slice(op.p, op.p + op.i.length)
			if op.i != textToBeRemoved
				throw new ConsistencyError(
					"Inserted content, '#{op.i}', does not match text to be removed, '#{textToBeRemoved}'"
				)

			return content.slice(0, op.p) + content.slice(op.p + op.i.length)

		else if op.d?
			return content.slice(0, op.p) + op.d + content.slice(op.p)

	rewindUpdates: (content, updates) ->
		for update in updates.reverse()
			content = DiffGenerator.rewindUpdate(content, update)
		return content

	buildDiff: (initialContent, updates) ->
		diff = [ u: initialContent ]
		for update in updates
			diff = DiffGenerator.applyUpdateToDiff diff, update
		return diff

	applyUpdateToDiff: (diff, update) ->
		position = 0
		op = update.op

		remainingDiff = diff.slice()
		{consumedDiff, remainingDiff} = DiffGenerator._consumeToOffset(remainingDiff, op.p)
		newDiff = consumedDiff

		if op.i?
			newDiff.push
				i: op.i
				meta: update.meta
		else if op.d?
			{consumedDiff, remainingDiff} = DiffGenerator._consumeDiffAffectedByDeleteUpdate remainingDiff, update
			newDiff.push(consumedDiff...)

		newDiff.push(remainingDiff...)

		return newDiff


	_consumeToOffset: (remainingDiff, totalOffset) ->
		consumedDiff = []
		position = 0
		while part = remainingDiff.shift()
			length = DiffGenerator._getLengthOfDiffPart part
			if part.d?
				consumedDiff.push part
			else if position + length >= totalOffset
				partOffset = totalOffset - position
				if partOffset > 0
					consumedDiff.push DiffGenerator._slicePart part, 0, partOffset
				if partOffset < length
					remainingDiff.unshift DiffGenerator._slicePart part, partOffset
				return {
					consumedDiff: consumedDiff
					remainingDiff: remainingDiff
				}
			else
				position += length
				consumedDiff.push part
		throw new Error("Ran out of diff to consume. Offset is too small")

	_consumeDiffAffectedByDeleteUpdate: (remainingDiff, deleteUpdate) ->
		consumedDiff = []
		remainingUpdate = deleteUpdate
		while remainingUpdate
			{newPart, remainingDiff, remainingUpdate} = DiffGenerator._consumeDeletedPart remainingDiff, remainingUpdate
			consumedDiff.push newPart if newPart?
		return {
			consumedDiff: consumedDiff
			remainingDiff: remainingDiff
		}

	_consumeDeletedPart: (remainingDiff, deleteUpdate) ->
		part = remainingDiff.shift()
		partLength = DiffGenerator._getLengthOfDiffPart part
		op = deleteUpdate.op

		if part.d?
			# Skip existing deletes
			remainingUpdate = deleteUpdate
			newPart = part

		else if partLength > op.d.length
			# Only the first bit of the part has been deleted
			remainingPart = DiffGenerator._slicePart part, op.d.length
			remainingDiff.unshift remainingPart

			deletedContent = DiffGenerator._getContentOfPart(part).slice(0, op.d.length)
			if deletedContent != op.d
				throw new ConsistencyError("deleted content, '#{deletedContent}', does not match delete op, '#{op.d}'")

			if part.u?
				newPart =
					d: op.d
					meta: deleteUpdate.meta
			else if part.i?
				newPart = null

			remainingUpdate = null

		else if partLength == op.d.length
			# The entire part has been deleted, but it is the last part

			deletedContent = DiffGenerator._getContentOfPart(part)
			if deletedContent != op.d
				throw new ConsistencyError("deleted content, '#{deletedContent}', does not match delete op, '#{op.d}'")

			if part.u?
				newPart =
					d: op.d
					meta: deleteUpdate.meta
			else if part.i?
				newPart = null

			remainingUpdate = null

		else if partLength < op.d.length
			# The entire part has been deleted and there is more

			deletedContent = DiffGenerator._getContentOfPart(part)
			opContent = op.d.slice(0, deletedContent.length)
			if deletedContent != opContent
				throw new ConsistencyError("deleted content, '#{deletedContent}', does not match delete op, '#{opContent}'")

			if part.u
				newPart =
					d: part.u
					meta: deleteUpdate.meta
			else if part.i?
				newPart = null

			remainingUpdate =
				op: { p: op.p, d: op.d.slice(DiffGenerator._getLengthOfDiffPart(part)) }
				meta: deleteUpdate.meta

		return {
			newPart: newPart
			remainingDiff: remainingDiff
			remainingUpdate: remainingUpdate
		}

	_slicePart: (basePart, from, to) ->
		if basePart.u?
			part = { u: basePart.u.slice(from, to) }
		else if basePart.i?
			part = { i: basePart.i.slice(from, to) }
		if basePart.meta?
			part.meta = basePart.meta
		return part

	_getLengthOfDiffPart: (part) ->
		(part.u or part.d or part.i).length

	_getContentOfPart: (part) ->
		part.u or part.d or part.i
