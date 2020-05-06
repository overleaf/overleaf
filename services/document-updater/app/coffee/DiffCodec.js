diff_match_patch = require("../lib/diff_match_patch").diff_match_patch
dmp = new diff_match_patch()

module.exports = DiffCodec =
	ADDED: 1
	REMOVED: -1
	UNCHANGED: 0

	diffAsShareJsOp: (before, after, callback = (error, ops) ->) ->
		diffs = dmp.diff_main(before.join("\n"), after.join("\n"))
		dmp.diff_cleanupSemantic(diffs)

		ops = []
		position = 0
		for diff in diffs
			type = diff[0]
			content = diff[1]
			if type == @ADDED
				ops.push
					i: content
					p: position
				position += content.length
			else if type == @REMOVED
				ops.push
					d: content
					p: position
			else if type == @UNCHANGED
				position += content.length
			else
				throw "Unknown type"
		callback null, ops
