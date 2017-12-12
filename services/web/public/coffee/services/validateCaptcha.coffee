define [
	"base"
], (App) ->
	App.factory "validateCaptcha", () ->
		_recaptchaCallbacks = []
		onRecaptchaSubmit = (token) ->
			for cb in _recaptchaCallbacks
				cb(token)
			_recaptchaCallbacks = []

		recaptchaId = null
		validateCaptcha = (callback = (response) ->) =>
			if !grecaptcha?
				return callback()
			reset = () ->
				grecaptcha.reset()
			_recaptchaCallbacks.push callback
			_recaptchaCallbacks.push reset
			if !recaptchaId?
				el = $('#recaptcha')[0]
				recaptchaId = grecaptcha.render(el, {callback: onRecaptchaSubmit})
			grecaptcha.execute(recaptchaId)

		return validateCaptcha
