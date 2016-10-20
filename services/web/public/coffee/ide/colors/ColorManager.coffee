define [], () ->
	ColorManager =
		getColorScheme: (hue, element) ->
			if @isDarkTheme(element)
				return {
					cursor: "hsl(#{hue}, 70%, 50%)"
					labelBackgroundColor: "hsl(#{hue}, 70%, 50%)"
					highlightBackgroundColor: "hsl(#{hue}, 100%, 28%);"
					strikeThroughBackgroundColor: "hsl(#{hue}, 100%, 20%);"
					strikeThroughForegroundColor: "hsl(#{hue}, 100%, 60%);"
				}
			else
				return {
					cursor: "hsl(#{hue}, 70%, 50%)"
					labelBackgroundColor: "hsl(#{hue}, 70%, 50%)"
					highlightBackgroundColor: "hsl(#{hue}, 70%, 85%);"
					strikeThroughBackgroundColor: "hsl(#{hue}, 70%, 95%);"
					strikeThroughForegroundColor: "hsl(#{hue}, 70%, 40%);"
				}

		isDarkTheme: (element) ->
			rgb = element.find(".ace_editor").css("background-color");
			[m, r, g, b] = rgb.match(/rgb\(([0-9]+), ([0-9]+), ([0-9]+)\)/)
			r = parseInt(r, 10)
			g = parseInt(g, 10)
			b = parseInt(b, 10)
			return r + g + b < 3 * 128
		
		OWN_HUE: 200 # We will always appear as this color to ourselves
		ANONYMOUS_HUE: 100
		getHueForUserId: (user_id) ->
			if !user_id? or user_id == "anonymous-user"
				return @ANONYMOUS_HUE

			if window.user.id == user_id
				return @OWN_HUE

			hash = CryptoJS.MD5(user_id)
			hue = parseInt(hash.toString().slice(0,8), 16) % 320
			# Avoid 20 degrees either side of the personal hue
			if hue > @OWNER_HUE - 20
				hue = hue + 40
			return hue
		