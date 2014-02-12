define [], () ->
	chooseOption = (testName, option1, option2, callback = (error, option) ->) ->
		if Math.random() < 0.5
			option = option1
		else
			option = option2

		loaded = false
		do initTest = ->
			return if loaded
			if mixpanel?.get_property?
				attributes = {}
				attributes[testName] = option
				mixpanel?.register_once( attributes )
				mixpanel?.people.set( attributes )
				loaded = true
				callback null, mixpanel?.get_property( testName )
			else
				setTimeout(initTest, 300)

		fallback = () ->
			return if loaded
			loaded = true
			callback null, option1
		setTimeout fallback, 1500
	
