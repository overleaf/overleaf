settings = require("settings-sharelatex")
logger = require("logger-sharelatex")

module.exports = RedirectManager =
	apply: (webRouter) ->
		for redirectUrl, target of settings.redirects
			do (target) ->
				method = target.method || 'get'
				webRouter[method] redirectUrl, RedirectManager.createRedirect(target)

	createRedirect: (target) ->
		(req, res, next) ->
			code = 302
			if typeof target is 'string'
				url = target
			else
				if target.method == "post"
					code = 307
				if typeof target.url == "function"
					url = target.url(req.params)
					if !url
						return next()
				else
					url = target.url
				if target.baseUrl?
					url = "#{target.baseUrl}#{url}"
			res.redirect code, url
