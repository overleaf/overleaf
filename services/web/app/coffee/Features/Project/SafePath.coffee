Path = require('path')

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

module.exports = SafePath =

	isCleanFilename: (filename) ->
		return SafePath.isAllowedLength(filename) &&
			not filename.match(BADCHAR_RX) &&
			not filename.match(BADFILE_RX)

	isAllowedLength: (pathname) ->
		return pathname.length > 0 && pathname.length <= MAX_PATH
