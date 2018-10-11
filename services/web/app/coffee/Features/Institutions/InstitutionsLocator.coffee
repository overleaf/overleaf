Institution = require('../../models/Institution').Institution
logger = require("logger-sharelatex")
ObjectId = require('mongoose').Types.ObjectId

module.exports = InstitutionLocator =

	findManagedInstitution: (managerId, callback)->
		logger.log managerId: managerId, "finding managed Institution"
		Institution.findOne managerIds: managerId, callback
