dropboxHandler = require('./DropboxHandler')
logger = require('logger-sharelatex')


module.exports =

	redirectUserToDropboxAuth: (req, res, next)->
		user_id = req.session.user._id
		dropboxHandler.getDropboxRegisterUrl user_id, (err, url)->
			return next(err) if err?
			logger.log url:url, "redirecting user for dropbox auth"
			res.redirect url

	completeDropboxRegistration: (req, res, next)->
		user_id = req.session.user._id
		dropboxHandler.completeRegistration user_id, (err, success)->
			return next(err) if err?
			res.redirect('/user/settings#dropboxSettings')

	unlinkDropbox: (req, res, next)->
		user_id = req.session.user._id
		dropboxHandler.unlinkAccount user_id, (err, success)->
			return next(err) if err?
			res.redirect('/user/settings#dropboxSettings')


