define [
	"base"
], (App) ->
	DEF_MIN_LENGTH = 20

	_decodeHTMLEntities = (str) ->
		str.replace /&#(\d+);/g, (match, dec) ->
    		String.fromCharCode dec;

	_getWrappedWordsString = (baseStr, wrapperElName, minLength) ->
		minLength = minLength || DEF_MIN_LENGTH
		words = baseStr.split ' '

		wordsWrapped = for word in words
			if _decodeHTMLEntities(word).length >= minLength
				"<#{wrapperElName} class=\"break-word\">#{word}</#{wrapperElName}>"
			else
				word

		outputStr = wordsWrapped.join ' '


	App.filter "wrapLongWords", () ->
		(input, minLength) ->
			_getWrappedWordsString input, "span", minLength