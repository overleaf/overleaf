define [], () ->

	browserIsSafari = () ->
		userAgent = navigator.userAgent
		(
			userAgent.match(/.*Safari\/.*/) &&
			!userAgent.match(/.*Chrome\/.*/) &&
			!userAgent.match(/.*Chromium\/.*/)
		)


	class Parser
		constructor: (@doc) ->

		parse: () ->
			# Safari regex is super slow, freezes browser for minutes on end,
			# hacky solution: limit iterations
			limit = null
			if browserIsSafari()
				limit = 100

			commands = []
			seen = {}
			iterations = 0
			while command = @nextCommand()
				iterations += 1
				if limit && iterations > limit
					return commands

				docState = @doc

				optionalArgs = 0
				while @consumeArgument("[", "]")
					optionalArgs++

				args = 0
				while @consumeArgument("{", "}")
					args++

				commandHash = "#{command}\\#{optionalArgs}\\#{args}"
				if !seen[commandHash]?
					seen[commandHash] = true
					commands.push [command, optionalArgs, args]

				# Reset to before argument to handle nested commands
				@doc = docState

			return commands

		# Ignore single letter commands since auto complete is moot then.
		commandRegex: /\\([a-zA-Z][a-zA-Z]+)/

		nextCommand: () ->
			i = @doc.search(@commandRegex)
			if i == -1
				return false
			else
				match = @doc.match(@commandRegex)[1]
				@doc = @doc.substr(i + match.length + 1)
				return match

		consumeWhitespace: () ->
			match = @doc.match(/^[ \t\n]*/m)[0]
			@doc = @doc.substr(match.length)

		consumeArgument: (openingBracket, closingBracket) ->
			@consumeWhitespace()

			if @doc[0] == openingBracket
				i = 1
				bracketParity = 1
				while bracketParity > 0 and i < @doc.length
					if @doc[i] == openingBracket
						bracketParity++
					else if @doc[i] == closingBracket
						bracketParity--
					i++

				if bracketParity == 0
					@doc = @doc.substr(i)
					return true
				else
					return false
			else
				return false

	class SuggestionManager
		getCompletions: (editor, session, pos, prefix, callback) ->
			doc = session.getValue()
			parser = new Parser(doc)
			commands = parser.parse()

			completions = []
			for command in commands
				caption = "\\#{command[0]}"
				snippet = caption
				i = 1
				_.times command[1], () ->
					snippet += "[${#{i}}]"
					caption += "[]"
					i++
				_.times command[2], () ->
					snippet += "{${#{i}}}"
					caption += "{}"
					i++
				unless caption == prefix
					completions.push {
						caption: caption
						snippet: snippet
						meta: "cmd"
					}

			callback null, completions

		loadCommandsFromDoc: (doc) ->
			parser = new Parser(doc)
			@commands = parser.parse()

		getSuggestions: (commandFragment) ->
			matchingCommands = _.filter @commands, (command) ->
				command[0].slice(0, commandFragment.length) == commandFragment

			return _.map matchingCommands, (command) ->
				base = "\\" + commandFragment

				args = ""
				_.times command[1], () -> args = args + "[]"
				_.times command[2], () -> args = args + "{}"
				completionBase = command[0].slice(commandFragment.length)

				squareArgsNo = command[1]
				curlyArgsNo = command[2]
				totalArgs = squareArgsNo + curlyArgsNo
				if totalArgs == 0
					completionBeforeCursor = completionBase
					completionAfterCurspr = ""
				else
					completionBeforeCursor = completionBase + args[0]
					completionAfterCursor = args.slice(1)

				return {
					base: base,
					completion: completionBase + args,
					completionBeforeCursor: completionBeforeCursor
					completionAfterCursor: completionAfterCursor
				}
