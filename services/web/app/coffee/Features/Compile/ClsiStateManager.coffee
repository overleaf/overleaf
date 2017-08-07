Settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
crypto = require "crypto"

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

buildState = (project) ->
	json = JSON.stringify(project.rootFolder)
	return crypto.createHash('sha1').update(json, 'utf8').digest('hex')

module.exports = ClsiStateManager =

	computeHash: (project, callback = (err, hash) ->) ->
		hash = buildState(project)
		callback(null, hash)
