_ = require("lodash")
async = require("async")

module.exports = ClsiFormatChecker =

	checkRecoursesForProblems: (resources, callback)->
		jobs = 
			conflictedPaths: (cb)->
				ClsiFormatChecker._checkForConflictingPaths resources, cb

			sizeCheck: (cb)->
				ClsiFormatChecker._checkDocsAreUnderSizeLimit resources, cb

		async.series jobs, (err, problems)->
			if err? 
				return callback(err)
			
			problems = _.omitBy(problems, _.isEmpty)

			if _.isEmpty(problems)
				return callback()
			else
				callback(null, problems)


	_checkForConflictingPaths: (resources, callback)->
		paths = _.map(resources, 'path')

		conflicts = _.filter paths, (path)->
			matchingPaths = _.filter paths, (checkPath)->
				return checkPath.indexOf(path+"/") != -1

			return matchingPaths.length > 0

		conflictObjects = _.map conflicts, (conflict)->
			path:conflict

		callback null, conflictObjects

	_checkDocsAreUnderSizeLimit: (resources, callback)->
		
		FIVEMB = 1000 * 1000 * 5

		totalSize = 0

		sizedResources = _.map resources, (resource)->
			result = {path:resource.path}
			if resource.content?
				result.size = resource.content.replace(/\n/g).length
				result.kbSize = Math.ceil(result.size / 1000)
			else
				result.size = 0
			totalSize += result.size
			return result

		tooLarge = totalSize > FIVEMB
		if !tooLarge
			return callback()
		else
			sizedResources = _.sortBy(sizedResources, "size").reverse().slice(0, 10)
			return callback(null, {resources:sizedResources, totalSize:totalSize})







