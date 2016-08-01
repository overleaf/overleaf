define [
	"base"
], (App) ->
	DEF_MIN_LENGTH = 20

	_getWrappedWordsString = (baseStr, wrapperElName, minLength) ->
		minLength = minLength || DEF_MIN_LENGTH

		findWordsRegEx = new RegExp "\\w{#{minLength},}", "g"
		wrappingTemplate = "<#{wrapperElName} class=\"break-word\">$&</#{wrapperElName}>"

		baseStr.replace findWordsRegEx, wrappingTemplate


	App.filter "wrapLongWords", () ->
		(input, minLength) ->
			_getWrappedWordsString input, "span", minLength