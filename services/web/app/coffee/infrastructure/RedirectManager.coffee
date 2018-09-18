settings = require("settings-sharelatex")
logger = require("logger-sharelatex")

module.exports = RedirectManager =
	apply: (webRouter) ->
		for redirectUrl, target of settings.redirects
			for method in (target.methods or ['get'])
				webRouter[method] redirectUrl, RedirectManager.createRedirect(target)

	createRedirect: (target) ->
		(req, res, next) ->
			code = 302
			if typeof target is 'string'
				url = target
			else
				if req.method == "POST"
					code = 307
				if typeof target.url == "function"
					url = target.url(req.params)
					if !url
						return next()
				else
					url = target.url
				if target.baseUrl?
					url = "#{target.baseUrl}#{url}"
			res.redirect code, url + getQueryString(req)

# Naively get the query params string. Stringifying the req.query object may
# have differences between Express and Rails, so safer to just pass the raw
# string
getQueryString = (req) ->
	qs = req.url.match(/\?.*$/)
	if qs? then qs[0] else ""
