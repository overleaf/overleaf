Settings = require 'settings-sharelatex'

module.exports = Features =
	externalAuthenticationSystemUsed: ->
		Settings.ldap? or Settings.saml? or Settings.overleaf?.oauth?

	hasFeature: (feature) ->
		switch feature
			when 'homepage'
				return Settings.enableHomepage
			when 'registration'
				return not Features.externalAuthenticationSystemUsed()
			when 'github-sync'
				return Settings.enableGithubSync
			when 'v1-return-message'
				return Settings.accountMerge? and Settings.overleaf?
			when 'custom-togglers'
				return Settings.overleaf?
			else
				throw new Error("unknown feature: #{feature}")
