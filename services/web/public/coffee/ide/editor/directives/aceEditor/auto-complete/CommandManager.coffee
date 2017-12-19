define [
	"./top_hundred_snippets"
], (topHundred) ->

	class Parser
		constructor: (@doc, @prefix) ->

		parse: () ->
			# Safari regex is super slow, freezes browser for minutes on end,
			# hacky solution: limit iterations
			limit = null
			if window?._ide?.browserIsSafari
				limit = 5000

			# fully formed commands
			realCommands = []
			# commands which match the prefix exactly,
			# and could be partially typed or malformed
			incidentalCommands = []
			seen = {}
			iterations = 0
			while command = @nextCommand()
				iterations += 1
				if limit && iterations > limit
					return realCommands

				docState = @doc

				optionalArgs = 0
				while @consumeArgument("[", "]")
					optionalArgs++

				args = 0
				while @consumeArgument("{", "}")
					args++

				commandHash = "#{command}\\#{optionalArgs}\\#{args}"

				if @prefix? && "\\#{command}" == @prefix
					incidentalCommands.push [command, optionalArgs, args]
				else
					if !seen[commandHash]?
						seen[commandHash] = true
						realCommands.push [command, optionalArgs, args]

				# Reset to before argument to handle nested commands
				@doc = docState

			# check incidentals, see if we should pluck out a match
			if incidentalCommands.length > 1
				bestMatch = incidentalCommands.sort((a, b) =>  a[1]+a[2] < b[1]+b[2])[0]
				realCommands.push bestMatch

			return realCommands

		# Ignore single letter commands since auto complete is moot then.
		commandRegex: /\\([a-zA-Z]{2,})/

		nextCommand: () ->
			i = @doc.search @commandRegex
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

	class CommandManager
		constructor: (@metadataManager) ->

		getCompletions: (editor, session, pos, prefix, callback) ->
			commandNames = (
				snippet.caption.match(/\w+/)[0] for snippet in topHundred
			)
			packages = @metadataManager.getAllPackages()
			packageCommands = []
			for pkg, snippets of packages
				for snippet in snippets
					packageCommands.push snippet
					commandNames.push snippet.caption.match(/\w+/)[0]

			doc = session.getValue()
			parser = new Parser(doc, prefix)
			commands = parser.parse()
			completions = []
			for command in commands
				if command[0] not in commandNames
					caption = "\\#{command[0]}"
					score = if caption == prefix then 99 else 50
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
					completions.push {
						caption: caption
						snippet: snippet
						meta: "cmd"
						score: score
					}
			completions = completions.concat topHundred, packageCommands

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
