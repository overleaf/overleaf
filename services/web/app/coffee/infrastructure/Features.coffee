Settings = require 'settings-sharelatex'

module.exports = Features =
	externalAuthenticationSystemUsed: ->
		Settings.ldap? or Settings.saml? or Settings.overleaf?.oauth?

	hasFeature: (feature) ->
		switch feature
			when 'homepage'
				return Settings.enableHomepage
			when 'registration'
				return not Features.externalAuthenticationSystemUsed() or Settings.overleaf?
			when 'github-sync'
				return Settings.enableGithubSync
			when 'git-bridge'
				return Settings.enableGitBridge
			when 'v1-return-message'
				return Settings.accountMerge? and Settings.overleaf?
			when 'custom-togglers'
				return Settings.overleaf?
			when 'publish-templates'
				return true
			when 'view-templates'
				return !Settings.overleaf?
			when 'affiliations'
				return Settings?.apis?.v1?.url?
			when 'rich-text'
				isEnabled = true # Switch to false to disable
				Settings.overleaf? and isEnabled
			when 'redirect-sl'
				return Settings.redirectToV2?
			else
				throw new Error("unknown feature: #{feature}")
