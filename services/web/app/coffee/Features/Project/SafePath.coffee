# This file is shared between the frontend and server code of web, so that
# filename validation is the same in both implementations.
# Both copies must be kept in sync:
#   app/coffee/Features/Project/SafePath.coffee
#   public/coffee/ide/directives/SafePath.coffee

load = () ->
	BADCHAR_RX = ///
		[
			\/ # no forward slashes
			\\ # no back slashes
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

	# Put a block on filenames which match javascript property names, as they
	# can cause exceptions where the code puts filenames into a hash. This is a
	# temporary workaround until the code in other places is made safe against
	# property names.
	#
	# The list of property names is taken from
	#   ['prototype'].concat(Object.getOwnPropertyNames(Object.prototype))
	BLOCKEDFILE_RX = ///
		^(
			prototype
			|constructor
			|toString
			|toLocaleString
			|valueOf
			|hasOwnProperty
			|isPrototypeOf
			|propertyIsEnumerable
			|__defineGetter__
			|__lookupGetter__
			|__defineSetter__
			|__lookupSetter__
			|__proto__
		)$
	///

	MAX_PATH = 1024 # Maximum path length, in characters. This is fairly arbitrary.

	SafePath =
		clean: (filename) ->
			filename = filename.replace BADCHAR_RX, '_'
			# for BADFILE_RX replace any matches with an equal number of underscores
			filename = filename.replace BADFILE_RX, (match) ->
				return new Array(match.length + 1).join("_")
			# replace blocked filenames 'prototype' with '@prototype'
			filename = filename.replace BLOCKEDFILE_RX, "@$1"
			return filename

		isCleanFilename: (filename) ->
			return SafePath.isAllowedLength(filename) &&
				!BADCHAR_RX.test(filename) &&
				!BADFILE_RX.test(filename) &&
				!BLOCKEDFILE_RX.test(filename)

		isAllowedLength: (pathname) ->
			return pathname.length > 0 && pathname.length <= MAX_PATH

if define?
	define [], load
else
	module.exports = load()
