define [
	"base"
], (App) ->	
	App.directive "mathjax", () ->
		return {
			link: (scope, element, attrs) ->
				if attrs.delimiter != 'no-single-dollar'
					inlineMathConfig = MathJax?.Hub?.config?.tex2jax.inlineMath
					alreadyConfigured = _.find inlineMathConfig, (c) ->
						c[0] == '$' and c[1] == '$'

					if !alreadyConfigured?
						MathJax?.Hub?.Config(
							tex2jax:
								inlineMath: inlineMathConfig.concat([['$', '$']])
						)

				setTimeout () ->
					MathJax?.Hub?.Queue(["Typeset", MathJax?.Hub, element.get(0)])
				, 0
		}