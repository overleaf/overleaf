define [
], () ->
	rx = /INPUT|SELECT|TEXTAREA/i

	$(document).bind "keydown keypress", (e)->
		if e.which == 8
			# 8 == backspace
			if !rx.test(e.target.tagName) || e.target.disabled || e.target.readOnly
				e.preventDefault()