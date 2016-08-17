define [
	"base"
], (App) ->
	App.factory 'ccUtils', () ->
		defaultFormat = /(\d{1,4})/g;
		defaultInputFormat =  /(?:^|\s)(\d{4})$/
		
		cards = [
			# Credit cards
			{
				type: 'visa'
				patterns: [4]
				format: defaultFormat
				length: [13, 16]
				cvcLength: [3]
				luhn: true
			}
			{
				type: 'mastercard'
				patterns: [
					51, 52, 53, 54, 55,
					22, 23, 24, 25, 26, 27
				]
				format: defaultFormat
				length: [16]
				cvcLength: [3]
				luhn: true
			}
			{
				type: 'amex'
				patterns: [34, 37]
				format: /(\d{1,4})(\d{1,6})?(\d{1,5})?/
				length: [15]
				cvcLength: [3..4]
				luhn: true
			}
			{
				type: 'dinersclub'
				patterns: [30, 36, 38, 39]
				format: /(\d{1,4})(\d{1,6})?(\d{1,4})?/
				length: [14]
				cvcLength: [3]
				luhn: true
			}
			{
				type: 'discover'
				patterns: [60, 64, 65, 622]
				format: defaultFormat
				length: [16]
				cvcLength: [3]
				luhn: true
			}
			{
				type: 'unionpay'
				patterns: [62, 88]
				format: defaultFormat
				length: [16..19]
				cvcLength: [3]
				luhn: false
			}
			{
				type: 'jcb'
				patterns: [35]
				format: defaultFormat
				length: [16]
				cvcLength: [3]
				luhn: true
			}
		]

		cardFromNumber = (num) ->
			num = (num + '').replace(/\D/g, "")
			for card in cards
				for pattern in card.patterns
					p = pattern + ""
					return card if num.substr(0, p.length) == p

		cardFromType = (type) ->
			return card for card in cards when card.type is type

		parseExpiry = (value = "") ->
			[month, year] = value.split(/[\s\/]+/, 2)

			# Allow for year shortcut
			if year?.length is 2 and /^\d+$/.test(year)
				prefix = (new Date).getFullYear()
				prefix = prefix.toString()[0..1]
				year   = prefix + year

			month = parseInt(month, 10)
			year  = parseInt(year, 10)

			month: month, year: year

		return {
			fromNumber: cardFromNumber
			fromType: cardFromType
			defaultFormat: defaultFormat
			defaultInputFormat: defaultInputFormat
			parseExpiry: parseExpiry
		}

	App.factory 'ccFormat', (ccUtils, $filter) ->
		hasTextSelected = ($target) ->
			# If some text is selected
			return true if $target.prop('selectionStart')? and
				$target.prop('selectionStart') isnt $target.prop('selectionEnd')

			# If some text is selected in IE
			if document?.selection?.createRange?
				return true if document.selection.createRange().text

			false

		# Replace Full-Width Chars
		replaceFullWidthChars = (str = '') ->
			fullWidth = '\uff10\uff11\uff12\uff13\uff14\uff15\uff16\uff17\uff18\uff19'
			halfWidth = '0123456789'

			value = ''
			chars = str.split('')

			# Avoid using reserved word `char`
			for chr in chars
				idx = fullWidth.indexOf(chr)
				chr = halfWidth[idx] if idx > -1
				value += chr

			value

		# Format Numeric
		reFormatNumeric = (e) ->
			$target = $(e.currentTarget)
			setTimeout ->
				value   = $target.val()
				value   = replaceFullWidthChars(value)
				value   = value.replace(/\D/g, '')
				safeVal(value, $target)

		# Format Card Number
		reFormatCardNumber = (e) ->
			$target = $(e.currentTarget)
			setTimeout ->
				value   = $target.val()
				value   = replaceFullWidthChars(value)
				value   = $.payment.formatCardNumber(value)
				#safeVal(value, $target)

		formatCardNumber = (e) ->
			# Only format if input is a number
			digit = String.fromCharCode(e.which)
			return unless /^\d+$/.test(digit)

			$target = $(e.currentTarget)
			value   = $target.val()
			card    = ccUtils.cardFromNumber(value + digit)
			length  = (value.replace(/\D/g, '') + digit).length

			upperLength = 16
			upperLength = card.length[card.length.length - 1] if card
			return if length >= upperLength

			# Return if focus isn't at the end of the text
			return if $target.prop('selectionStart')? and
				$target.prop('selectionStart') isnt value.length

			if card && card.type is 'amex'
				# AMEX cards are formatted differently
				re = /^(\d{4}|\d{4}\s\d{6})$/
			else
				re = /(?:^|\s)(\d{4})$/

			# If '4242' + 4
			if re.test(value)
				e.preventDefault()
				setTimeout -> $target.val(value + ' ' + digit)

			# If '424' + 2
			else if re.test(value + digit)
				e.preventDefault()
				setTimeout -> $target.val(value + digit + ' ')

		formatBackCardNumber = (e) ->
			$target = $(e.currentTarget)
			value   = $target.val()

			# Return unless backspacing
			return unless e.which is 8

			# Return if focus isn't at the end of the text
			return if $target.prop('selectionStart')? and
				$target.prop('selectionStart') isnt value.length

			# Remove the digit + trailing space
			if /\d\s$/.test(value)
				e.preventDefault()
				setTimeout -> $target.val(value.replace(/\d\s$/, ''))
			# Remove digit if ends in space + digit
			else if /\s\d?$/.test(value)
				e.preventDefault()
				setTimeout -> $target.val(value.replace(/\d$/, ''))

		# Format Expiry
		reFormatExpiry = (e) ->
			$target = $(e.currentTarget)
			setTimeout ->
				value   = $target.val()
				value   = replaceFullWidthChars(value)
				value   = $.payment.formatExpiry(value)
				safeVal(value, $target)

		formatExpiry = (e) ->
			# Only format if input is a number
			digit = String.fromCharCode(e.which)
			return unless /^\d+$/.test(digit)

			$target = $(e.currentTarget)
			val     = $target.val() + digit

			if /^\d$/.test(val) and val not in ['0', '1']
				e.preventDefault()
				setTimeout -> $target.val("0#{val} / ")

			else if /^\d\d$/.test(val)
				e.preventDefault()
				setTimeout ->
					# Split for months where we have the second digit > 2 (past 12) and turn
					# that into (m1)(m2) => 0(m1) / (m2)
					m1 = parseInt(val[0], 10)
					m2 = parseInt(val[1], 10)
					if m2 > 2 and m1 != 0
						$target.val("0#{m1} / #{m2}")
					else
						$target.val("#{val} / ")

		formatForwardExpiry = (e) ->
			digit = String.fromCharCode(e.which)
			return unless /^\d+$/.test(digit)

			$target = $(e.currentTarget)
			val     = $target.val()

			if /^\d\d$/.test(val)
				$target.val("#{val} / ")

		formatForwardSlash = (e) ->
			which = String.fromCharCode(e.which)
			return unless which is '/' or which is ' '

			$target = $(e.currentTarget)
			val     = $target.val()

			if /^\d$/.test(val) and val isnt '0'
				$target.val("0#{val} / ")

		formatBackExpiry = (e) ->
			$target = $(e.currentTarget)
			value   = $target.val()

			# Return unless backspacing
			return unless e.which is 8

			# Return if focus isn't at the end of the text
			return if $target.prop('selectionStart')? and
				$target.prop('selectionStart') isnt value.length

			# Remove the trailing space + last digit
			if /\d\s\/\s$/.test(value)
				e.preventDefault()
				setTimeout -> $target.val(value.replace(/\d\s\/\s$/, ''))

		parseExpiry = (value) ->
			if value?
				dateAsObj = ccUtils.parseExpiry(value);
				expiry = new Date dateAsObj.year, dateAsObj.month - 1
				return $filter('date')(expiry, 'MM/yyyy')

		# Format CVC
		reFormatCVC = (e) ->
			$target = $(e.currentTarget)
			setTimeout ->
				value   = $target.val()
				value   = replaceFullWidthChars(value)
				value   = value.replace(/\D/g, '')[0...4]
				safeVal(value, $target)

		# Restrictions
		restrictNumeric = (e) ->
			# Key event is for a browser shortcut
			return true if e.metaKey or e.ctrlKey

			# If keycode is a space
			return false if e.which is 32

			# If keycode is a special char (WebKit)
			return true if e.which is 0

			# If char is a special char (Firefox)
			return true if e.which < 33

			input = String.fromCharCode(e.which)

			# Char is a number or a space
			!!/[\d\s]/.test(input)

		restrictCardNumber = (e) ->
			$target = $(e.currentTarget)
			digit   = String.fromCharCode(e.which)
			return unless /^\d+$/.test(digit)

			return if hasTextSelected($target)

			# Restrict number of digits
			value = ($target.val() + digit).replace(/\D/g, '')
			card  = cardFromNumber(value)

			if card
				value.length <= card.length[card.length.length - 1]
			else
				# All other cards are 16 digits long
				value.length <= 16

		restrictExpiry = (e) ->
			$target = $(e.currentTarget)
			digit   = String.fromCharCode(e.which)
			return unless /^\d+$/.test(digit)

			return if hasTextSelected($target)

			value = $target.val() + digit
			value = value.replace(/\D/g, '')

			return false if value.length > 6

		restrictCVC = (e) ->
			$target = $(e.currentTarget)
			digit   = String.fromCharCode(e.which)
			return unless /^\d+$/.test(digit)

			return if hasTextSelected($target)

			val     = $target.val() + digit
			val.length <= 4

		setCardType = (e) ->
			$target  = $(e.currentTarget)
			val      = $target.val()
			cardType = $.payment.cardType(val) or 'unknown'

			unless $target.hasClass(cardType)
				allTypes = (card.type for card in cards)

				$target.removeClass('unknown')
				$target.removeClass(allTypes.join(' '))

				$target.addClass(cardType)
				$target.toggleClass('identified', cardType isnt 'unknown')
				$target.trigger('payment.cardType', cardType)

		return {
			hasTextSelected
			replaceFullWidthChars
			reFormatNumeric
			reFormatCardNumber
			formatCardNumber
			formatBackCardNumber
			reFormatExpiry
			formatExpiry
			formatForwardExpiry
			formatForwardSlash
			formatBackExpiry
			parseExpiry
			reFormatCVC
			restrictNumeric
			restrictCardNumber
			restrictExpiry
			restrictCVC
			setCardType
		}
		
	App.directive 'ccFormatExpiry', (ccFormat) ->
		restrict: 'A'
		require: 'ngModel'
		link: (scope, el, attrs, ngModel) ->
			el.on 'keypress', 	ccFormat.restrictExpiry
			el.on 'keypress', 	ccFormat.formatExpiry
			el.on 'keypress', 	ccFormat.formatForwardSlash
			el.on 'keypress', 	ccFormat.formatForwardExpiry
			el.on 'keydown', 	ccFormat.formatBackExpiry

			ngModel.$parsers.push ccFormat.parseExpiry
			ngModel.$formatters.push ccFormat.parseExpiry


	