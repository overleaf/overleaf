define () ->
	environments = [
		"abstract", 
		"align", "align*",
		"equation", "equation*",
		"gather", "gather*",
		"mutliline", "multiline*",
		"split",
		"verbatim"
	]

	snippets = for env in environments
		{
			caption: "\\begin{#{env}}..."
			snippet: """
				\\begin{#{env}}
				$1
				\\end{#{env}}
			"""
			meta: "env"
		}

	snippets = snippets.concat [{
		caption: "\\begin{array}..."
		snippet: """
			\\begin{array}{${1:cc}}
			$2 & $3 \\\\\\\\
			$4 & $5
			\\end{array}
		"""
		meta: "env"
	}, {
		caption: "\\begin{figure}..."
		snippet: """
			\\begin{figure}
			\\centering
			\\includegraphics{$1}
			\\caption{${2:Caption}}
			\\label{${3:fig:my_label}}
			\\end{figure}
		"""
		meta: "env"
	}, {
		caption: "\\begin{tabular}..."
		snippet: """
			\\begin{tabular}{${1:c|c}}
			$2 & $3 \\\\\\\\
			$4 & $5
			\\end{tabular}
		"""
		meta: "env"
	}, {
		caption: "\\begin{table}..."
		snippet: """
			\\begin{table}[$1]
			\\centering
			\\begin{tabular}{${2:c|c}}
			$3 & $4 \\\\\\\\
			$5 & $6
			\\end{tabular}
			\\caption{${7:Caption}}
			\\label{${8:tab:my_label}}
			\\end{table}
		"""
		meta: "env"
	}, {
		caption: "\\begin{list}..."
		snippet: """
			\\begin{list}
			\\item $1
			\\end{list}
		"""
		meta: "env"
	}, {
		caption: "\\begin{enumerate}..."
		snippet: """
			\\begin{enumerate}
			\\item $1
			\\end{enumerate}
		"""
		meta: "env"
	}, {
		caption: "\\begin{itemize}..."
		snippet: """
			\\begin{itemize}
			\\item $1
			\\end{itemize}
		"""
		meta: "env"
	}, {
		caption: "\\begin{frame}..."
		snippet: """
			\\begin{frame}{${1:Frame Title}}
			$2
			\\end{frame}
		"""
		meta: "env"
	}]

	return snippets