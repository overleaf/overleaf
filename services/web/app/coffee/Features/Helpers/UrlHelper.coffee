Settings = require 'settings-sharelatex'

module.exports = UrlHelper =

	wrapUrlWithProxy: (url) ->
		# TODO: Consider what to do for Community and Enterprise edition?
		if !Settings.apis?.linkedUrlProxy?.url?
			throw new Error('no linked url proxy configured')
		return "#{Settings.apis.linkedUrlProxy.url}?url=#{encodeURIComponent(url)}"

	prependHttpIfNeeded: (url) ->
		if !url.match('://')
			url = 'http://' + url
		return url