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
				return Settings.accountMerge? and Settings.overleaf? and !Settings.forceImportToV2
			when 'custom-togglers'
				return Settings.overleaf?
			when 'publish-templates'
				return true
			when 'view-templates'
				return !Settings.overleaf?
			when 'affiliations'
				return Settings?.apis?.v1?.url?
			when 'redirect-sl'
				return Settings.redirectToV2?
			when 'force-import-to-v2'
				return Settings.forceImportToV2
			else
				throw new Error("unknown feature: #{feature}")
