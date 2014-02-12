_ = require "underscore"

module.exports =

	areSame: (lines1, lines2)->
		if !Array.isArray(lines1) or !Array.isArray(lines2)
			return false

		return _.isEqual(lines1, lines2)

