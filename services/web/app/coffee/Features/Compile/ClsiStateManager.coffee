Settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
crypto = require "crypto"
ProjectEntityHandler = require "../Project/ProjectEntityHandler"

# The "state" of a project is a hash of the relevant attributes in the
# project object in this case we only need the rootFolder.
#
# The idea is that it will change if any doc or file is
# created/renamed/deleted, and also if the content of any file (not
# doc) changes.
#
# When the hash changes the full set of files on the CLSI will need to
# be updated.  If it doesn't change then we can overwrite changed docs
# in place on the clsi, getting them from the docupdater.
#
# The docupdater is responsible for setting the key in redis, and
# unsetting it if it removes any documents from the doc updater.

buildState = (s) ->
	return crypto.createHash('sha1').update(s, 'utf8').digest('hex')

module.exports = ClsiStateManager =

	computeHash: (project, options, callback = (err, hash) ->) ->
		ProjectEntityHandler.getAllEntitiesFromProject project, (err, docs, files) ->
			fileList = ("#{f.file._id}:#{f.file.rev}:#{f.file.created}:#{f.path}" for f in files or [])
			docList = ("#{d.doc._id}:#{d.path}" for d in docs or [])
			sortedEntityList = [docList..., fileList...].sort()
			# ignore the isAutoCompile options as it doesn't affect the
			# output, but include all other options e.g. draft
			optionsList = ("option #{key}:#{value}" for key, value of options or {} when not (key in ['isAutoCompile']))
			sortedOptionsList = optionsList.sort()
			hash = buildState([sortedEntityList..., sortedOptionsList...].join("\n"))
			callback(null, hash)
