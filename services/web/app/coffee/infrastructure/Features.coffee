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
			when 'v2-banner'
				return Settings.showV2Banner
			when 'custom-togglers'
				return Settings.overleaf?
			when 'templates'
				return !Settings.overleaf?
			when 'affiliations'
				return Settings?.apis?.v1?.url?
			when 'rich-text'
				isEnabled = false # Switch to false to disable
				Settings.overleaf? and isEnabled
			else
				throw new Error("unknown feature: #{feature}")
