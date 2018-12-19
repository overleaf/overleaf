settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
URL = require('url')
querystring = require('querystring')

module.exports = RedirectManager =
	apply: (webRouter) ->
		for redirectUrl, target of settings.redirects
			for method in (target.methods or ['get'])
				webRouter[method] redirectUrl, RedirectManager.createRedirect(target)

	createRedirect: (target) ->
		(req, res, next) ->
			return next() if req.headers?['x-skip-redirects']?
			code = 302
			if typeof target is 'string'
				url = target
			else
				if req.method != "GET"
					code = 307

				if typeof target.url == "function"
					url = target.url(req.params)
					if !url
						return next()
				else
					url = target.url

				# Special handling for redirecting to v1, to ensure that query params
				# are encoded
				if target.authWithV1
					url = "/sign_in_to_v1?" + querystring.stringify(return_to: url + getQueryString(req))
					return res.redirect code, url

				if target.baseUrl?
					url = "#{target.baseUrl}#{url}"
			res.redirect code, url + getQueryString(req)

# Naively get the query params string. Stringifying the req.query object may
# have differences between Express and Rails, so safer to just pass the raw
# string
getQueryString = (req) ->
	{search} = URL.parse(req.url)
	if search then search else ""
