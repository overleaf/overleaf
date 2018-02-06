define [
	"base"
], (App) ->

	# copied from app/coffee/Features/Project/SafePath.coffee

	BADCHAR_RX = ///
	[
		\/ # no slashes
		\* # no asterisk
		\u0000-\u001F # no control characters (0-31)
		\u007F        # no delete
		\u0080-\u009F # no unicode control characters (C1)
		\uD800-\uDFFF # no unicode surrogate characters
	]
	///g

	BADFILE_RX = ///
		(^\.$)      # reject . as a filename
		| (^\.\.$)  # reject .. as a filename
		| (^\s+)    # reject leading space
		| (\s+$)    # reject trailing space
	///g

	MAX_PATH = 1024 # Maximum path length, in characters. This is fairly arbitrary.

	App.directive "validFile", () ->
		return {
			require: 'ngModel'
			link: (scope, element, attrs, ngModelCtrl) ->
				ngModelCtrl.$validators.validFile = (filename) ->
					isValid = filename.length > 0 && filename.length < MAX_PATH &&
						not filename.match(BADCHAR_RX) &&
						not filename.match(BADFILE_RX)
					return isValid
		}
