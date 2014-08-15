define [
	"text!html/templates.html"
	"text!css/chat.css"
], (templates, css)->

	appendAssets : ->
		$(document.body).append($(templates))
		style = $("<style/>")
		style.html(css)
		$(document.body).append(style)
