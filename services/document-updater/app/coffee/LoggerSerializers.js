_ = require('lodash')

showLength = (thing) ->
	if thing?.length then thing.length else thing

showUpdateLength = (update) ->
	if update?.op instanceof Array
		copy = _.cloneDeep(update)
		copy.op.forEach (element, index) ->
			copy.op[index].i = element.i.length if element?.i?.length?
			copy.op[index].d = element.d.length if element?.d?.length?
			copy.op[index].c = element.c.length if element?.c?.length?
		copy
	else
		update

module.exports =
	# replace long values with their length
	lines: showLength
	oldLines: showLength
	newLines: showLength
	docLines: showLength
	newDocLines: showLength
	ranges: showLength
	update: showUpdateLength
