define [
	"base"
	"mathjax"
], (App) ->
	mathjaxConfig =
		"HTML-CSS": { availableFonts: ["TeX"] },
		TeX:
			equationNumbers: { autoNumber: "AMS" },
			useLabelIDs: false
		tex2jax:
			inlineMath: [ ['$','$'], ["\\(","\\)"] ],
			displayMath: [ ['$$','$$'], ["\\[","\\]"] ],
			processEscapes: true
		skipStartupTypeset: true

	MathJax.Hub.Config(mathjaxConfig);
	
	App.directive "mathjax", () ->
		return {
			link: (scope, element, attrs) ->
				setTimeout () ->
					MathJax.Hub.Queue(["Typeset", MathJax.Hub, element.get(0)])
				, 0
		}