define [
	"base"
], (App) ->
	DEF_MIN_LENGTH = 20

	_getWrappedWordsString = (baseStr, wrapperElName, minLength) ->
		minLength = minLength || DEF_MIN_LENGTH

		findWordsRegEx = new RegExp "\\w{#{minLength},}", "g"
		wrappingTemplate = "<#{wrapperElName} style='word-break: break-all;'>$&</#{wrapperElName}>"

		baseStr.replace findWordsRegEx, wrappingTemplate


	App.filter "wrapLongWords", () ->
		(input, minLength) ->
			_getWrappedWordsString input, "span", minLength