showLength = (thing) ->
	"length: #{thing?.length}"

module.exports =
	# replace long values with their length
	lines: showLength
	oldLines: showLength
	newLines: showLength
	ranges: showLength
	update: showLength
