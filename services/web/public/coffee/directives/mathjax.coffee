define [
	"base"
], (App) ->	
	App.directive "mathjax", () ->
		return {
			link: (scope, element, attrs) ->
				mathjaxConfig =
					extensions: ["Safe.js"]
					messageStyle: "none"
					imageFont:null
					"HTML-CSS": { availableFonts: ["TeX"] },
					TeX:
						equationNumbers: { autoNumber: "AMS" },
						useLabelIDs: false
					skipStartupTypeset: true
					tex2jax:
						processEscapes: true,
						inlineMath: [ ["\\(","\\)"] ],
						displayMath: [ ['$$','$$'], ["\\[","\\]"] ]
				if attrs.delimiter != 'no-single-dollar'
					mathjaxConfig.tex2jax.inlineMath.push(['$','$']);

				MathJax?.Hub?.Config(mathjaxConfig);

				setTimeout () ->
					MathJax?.Hub?.Queue(["Typeset", MathJax?.Hub, element.get(0)])
				, 0
		}