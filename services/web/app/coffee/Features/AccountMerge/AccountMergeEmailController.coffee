UserGetter = require '../User/UserGetter'
UserUpdater = require '../User/UserUpdater'
OneTimeTokenHandler = require '../Security/OneTimeTokenHandler'
logger = require 'logger-sharelatex'
Settings = require 'settings-sharelatex'


module.exports = AccountMergeEmailController =

	confirmMergeFromEmail: (req, res, next) ->
		token = req.query.token
		if !token
			return res.status(400).send()
		OneTimeTokenHandler.getValueFromTokenAndExpire 'account-merge-email-to-ol', token, (err, data) ->
			return next(err) if err?
			if !data
				return res.status(404).send()
			if data.origin != 'sl'
				logger.log {}, "Only sharelatex origin supported"
				return res.status(501).send()
			{ sl_id, v1_id, final_email } = data
			UserGetter.getUser sl_id, {_id: 1, overleaf: 1}, (err, user) ->
				return next(err) if err?
				if !user?
					logger.err {userId: sl_id}, 'SL user not found for account-merge'
					return res.status(400).send()
				if user?.overleaf?.id?
					logger.err {userId: sl_id}, 'SL user is already linked to overleaf'
					return res.status(400).send()
				logger.log {sl_id, v1_id, final_email, origin: data.origin},
					"[AccountMergeEmailController] about to merge sharelatex and overleaf-v1 accounts"
				UserUpdater.mergeSharelatexAndV1Accounts sl_id, v1_id, final_email, (err) ->
					return next(err) if err?
					res.render 'account_merge/finish', {
						finalEmail: final_email
					}
