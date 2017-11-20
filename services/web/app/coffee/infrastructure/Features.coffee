Settings = require 'settings-sharelatex'

module.exports = Features =
	externalAuthenticationSystemUsed: ->
		Settings.ldap? or Settings.saml? or Settings.overleaf?.oauth?

	hasFeature: (feature) ->
		switch feature
			when 'registration'
				return not Features.externalAuthenticationSystemUsed()
			else
				throw new Error("unknown feature: #{feature}")
