sanitize = require('sanitizer')

module.exports =
	validateEmail : (email) ->
		re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\ ".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA -Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
		return re.test(email)

	hasZeroLengths : (props) ->
		hasZeroLength = false
		props.forEach (prop) ->
			if prop.length == 0
				hasZeroLength = true
		return hasZeroLength

	validateRegisterRequest : (req, callback)->
		email = sanitize.escape(req.body.email).trim().toLowerCase()
		password = req.body.password
		username = email.match(/^[^@]*/)
		if username?
			first_name = username[0]
		else
			first_name = ""
		last_name = ""

		if @hasZeroLengths([password, email])
			callback('please fill in all the fields', null)
		else if !@validateEmail(email)
			callback('not valid email', null)
		else
			callback(null, {first_name:first_name, last_name:last_name, email:email, password:password})



	registerNewUser: (userDetails, callback)->

		callback()