define () ->
	environments = [
		"abstract",
		"align", "align*",
		"equation", "equation*",
		"gather", "gather*",
		"multline", "multline*",
		"split",
		"verbatim"
	]

	staticSnippets = for env in environments
		{
			caption: "\\begin{#{env}}..."
			snippet: """
				\\begin{#{env}}
				\t$1
				\\end{#{env}}
			"""
			meta: "env"
		}

	staticSnippets = staticSnippets.concat [{
		caption: "\\begin{array}..."
		snippet: """
			\\begin{array}{${1:cc}}
			\t$2 & $3 \\\\\\\\
			\t$4 & $5
			\\end{array}
		"""
		meta: "env"
	}, {
		caption: "\\begin{figure}..."
		snippet: """
			\\begin{figure}
			\t\\centering
			\t\\includegraphics{$1}
			\t\\caption{${2:Caption}}
			\t\\label{${3:fig:my_label}}
			\\end{figure}
		"""
		meta: "env"
	}, {
		caption: "\\begin{tabular}..."
		snippet: """
			\\begin{tabular}{${1:c|c}}
			\t$2 & $3 \\\\\\\\
			\t$4 & $5
			\\end{tabular}
		"""
		meta: "env"
	}, {
		caption: "\\begin{table}..."
		snippet: """
			\\begin{table}[$1]
			\t\\centering
			\t\\begin{tabular}{${2:c|c}}
			\t\t$3 & $4 \\\\\\\\
			\t\t$5 & $6
			\t\\end{tabular}
			\t\\caption{${7:Caption}}
			\t\\label{${8:tab:my_label}}
			\\end{table}
		"""
		meta: "env"
	}, {
		caption: "\\begin{list}..."
		snippet: """
			\\begin{list}
			\t\\item $1
			\\end{list}
		"""
		meta: "env"
	}, {
		caption: "\\begin{enumerate}..."
		snippet: """
			\\begin{enumerate}
			\t\\item $1
			\\end{enumerate}
		"""
		meta: "env"
	}, {
		caption: "\\begin{itemize}..."
		snippet: """
			\\begin{itemize}
			\t\\item $1
			\\end{itemize}
		"""
		meta: "env"
	}, {
		caption: "\\begin{frame}..."
		snippet: """
			\\begin{frame}{${1:Frame Title}}
			\t$2
			\\end{frame}
		"""
		meta: "env"
	}]


	parseCustomEnvironments = (text) ->
		re = /^\\newenvironment{(\w+)}.*$/gm
		result = []
		iterations = 0
		while match = re.exec(text)
			result.push {name: match[1], whitespace: null}
			iterations += 1
			if iterations >= 1000
				return result
		return result


	parseBeginCommands = (text) ->
		re = /^\\begin{(\w+)}.*\n([\t ]*).*$/gm
		result = []
		iterations = 0
		while match = re.exec(text)
			result.push {name: match[1], whitespace: match[2]}
			iterations += 1
			if iterations >= 1000
				return result
		return result

	class SnippetManager
		getCompletions: (editor, session, pos, prefix, callback) ->
			docText = session.getValue()
			customEnvironments = parseCustomEnvironments(docText)
			beginCommands = parseBeginCommands(docText)
			parsedItemsMap = {}
			for environment in customEnvironments
				parsedItemsMap[environment.name] = environment
			for command in beginCommands
				parsedItemsMap[command.name] = command
			parsedItems = _.values(parsedItemsMap)
			snippets = staticSnippets.concat(
				parsedItems.map (item) ->
					{
						caption: "\\begin{#{item.name}}..."
						snippet: """
							\\begin{#{item.name}}
							#{item.whitespace || ''}$1
							\\end{#{item.name}}
						"""
						meta: "env"
					}
			).concat(
				# arguably these `end` commands shouldn't be here, as they're not snippets
				# but this is where we have access to the `begin` environment names
				# *shrug*
				parsedItems.map (item) ->
					{
						caption: "\\end{#{item.name}}"
						value: "\\end{#{item.name}}"
						meta: "env"
					}
			)
			callback null, snippets

	return SnippetManager
