# This file is shared between the frontend and server code of web, so that
# filename validation is the same in both implementations.  
# Both copies must be kept in sync:
#   app/coffee/Features/Project/SafePath.coffee
#   public/coffee/ide/directives/SafePath.coffee

load = () ->
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
		|	(^\.\.$)  # reject .. as a filename
		| (^\s+)    # reject leading space
		| (\s+$)    # reject trailing space
		///g

	MAX_PATH = 1024 # Maximum path length, in characters. This is fairly arbitrary.

	SafePath =
		clean: (filename) ->
			filename = filename.replace BADCHAR_RX, '_'
			# for BADFILE_RX replace any matches with an equal number of underscores
			filename = filename.replace BADFILE_RX, (match) -> 
				return new Array(match.length + 1).join("_")
			return filename

		isCleanFilename: (filename) ->
			return SafePath.isAllowedLength(filename) &&
				not filename.match(BADCHAR_RX) &&
				not filename.match(BADFILE_RX)

		isAllowedLength: (pathname) ->
			return pathname.length > 0 && pathname.length <= MAX_PATH

if define?
	define [], load
else
	module.exports = load()