define [], () ->
	noArgumentCommands = [
		'item', 'hline', 'lipsum', 'centering', 'noindent', 'textwidth', 'draw',
		'maketitle', 'newpage', 'verb', 'bibliography', 'hfill', 'par',
		'in', 'sum', 'cdot', 'ldots', 'linewidth', 'left', 'right', 'today',
		'clearpage', 'newline', 'endinput', 'tableofcontents', 'vfill',
		'bigskip', 'fill', 'cleardoublepage', 'infty', 'leq', 'geq', 'times',
		'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta',
		'eta', 'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi',
		'pi', 'varpi', 'rho', 'varrho', 'sigma', 'varsigma', 'tau', 'upsilon',
		'phi', 'varphi', 'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta',
		'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega'
	]
	singleArgumentCommands = [
		'chapter', 'usepackage', 'section', 'label', 'textbf', 'subsection',
		'vspace', 'cite', 'textit', 'documentclass', 'includegraphics', 'input',
		'emph','caption', 'ref', 'title', 'author', 'texttt', 'include',
		'hspace', 'bibitem', 'url', 'large', 'subsubsection', 'textsc', 'date',
		'footnote', 'small', 'thanks', 'underline', 'graphicspath', 'pageref',
		'section*', 'subsection*', 'subsubsection*', 'sqrt', 'text',
		'normalsize', 'footnotesize', 'Large', 'paragraph', 'pagestyle',
		'thispagestyle', 'bibliographystyle', 'hat'
	]
	doubleArgumentCommands = [
		'newcommand', 'frac', 'dfrac', 'renewcommand', 'setlength', 'href',
		'newtheorem'
	]
	tripleArgumentCommands = [
		'addcontentsline', 'newacronym', 'multicolumn'
	]
	special = ['LaTeX', 'TeX']

	rawCommands = [].concat(
		noArgumentCommands,
		singleArgumentCommands,
		doubleArgumentCommands,
		tripleArgumentCommands,
		special
	)

	noArgumentCommands = for cmd in noArgumentCommands
		{
			caption: "\\#{cmd}"
			snippet: "\\#{cmd}"
			meta: "cmd"
		}
	singleArgumentCommands = for cmd in singleArgumentCommands
		{
			caption: "\\#{cmd}{}"
			snippet: "\\#{cmd}{$1}"
			meta: "cmd"
		}
	doubleArgumentCommands = for cmd in doubleArgumentCommands
		{
			caption: "\\#{cmd}{}{}"
			snippet: "\\#{cmd}{$1}{$2}"
			meta: "cmd"
		}
	tripleArgumentCommands = for cmd in tripleArgumentCommands
		{
			caption: "\\#{cmd}{}{}{}"
			snippet: "\\#{cmd}{$1}{$2}{$3}"
			meta: "cmd"
		}
	special = for cmd in special
			{
				caption: "\\#{cmd}{}"
				snippet: "\\#{cmd}{}"
				meta: "cmd"
			}

	staticCommands = [].concat(
						noArgumentCommands,
						singleArgumentCommands,
						doubleArgumentCommands,
						tripleArgumentCommands,
						special
					)

	packageCommandMappings = {
		amsmath: ['holyshititworks', 'mathematics']
		natbib: ['somebibliographystuff']
	}

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

	class CommandManager
		constructor: (@labelsManager) ->

		getCompletions: (editor, session, pos, prefix, callback) ->
			packages = @labelsManager.getAllPackages()
			packageCommands = []
			for pkg in packages
				if packageCommandMappings[pkg]?
					for cmd in packageCommandMappings[pkg]
						packageCommands.push {
							caption: "\\#{cmd}"
							snippet: "\\#{cmd}"
							meta: "cmd"
						}

			doc = session.getValue()
			parser = new Parser(doc, prefix)
			commands = parser.parse()
			completions = []
			for command in commands
				if command[0] not in rawCommands
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
			completions = completions.concat staticCommands, packageCommands

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
