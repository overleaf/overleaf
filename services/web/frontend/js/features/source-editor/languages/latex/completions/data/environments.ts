export const snippet = (name: string) => `\\begin{${name}}
\t$1
\\end{${name}}`

export const snippetNoIndent = (name: string) => `\\begin{${name}}
$1
\\end{${name}}`

export const environments = new Map([
  ['abstract', snippet('abstract')],
  ['align', snippet('align')],
  ['align*', snippet('align*')],
  [
    'array',
    `\\begin{array}{\${1:cc}}
\t$2 & $3 \\\\
\t$4 & $5
\\end{array}`,
  ],
  ['center', snippet('center')],
  [
    'description',
    `\\begin{description}
\t\\item[$1] $2
\\end{description}`,
  ],
  ['document', snippetNoIndent('document')],
  ['equation', snippet('equation')],
  ['equation*', snippet('equation*')],
  [
    'enumerate',
    `\\begin{enumerate}
\t\\item $1
\\end{enumerate}`,
  ],
  [
    'figure',
    `\\begin{figure}
\t\\centering
\t\\includegraphics[width=0.5\\linewidth]{$1}
\t\\caption{\${2:Caption}}
\t\\label{\${3:fig:placeholder}}
\\end{figure}`,
  ],
  [
    'frame',
    `\\begin{frame}{\${1:Frame Title}}
\t$2
\\end{frame}`,
  ],
  ['gather', snippet('gather')],
  ['gather*', snippet('gather*')],
  [
    'itemize',
    `\\begin{itemize}
\t\\item $1
\\end{itemize}`,
  ],
  ['multline', snippet('multline')],
  ['multline*', snippet('multline*')],
  ['quote', snippet('quote')],
  ['split', snippet('split')],
  [
    'table',
    `\\begin{table}[$1]
\t\\centering
\t\\begin{tabular}{\${2:c|c}}
\t\t$3 & $4 \\\\
\t\t$5 & $6
\t\\end{tabular}
\t\\caption{\${7:Caption}}
\t\\label{\${8:tab:placeholder}}
\\end{table}`,
  ],
  [
    'tabular',
    `\\begin{tabular}{\${1:c|c}}
\t$2 & $3 \\\\
\t$4 & $5
\\end{tabular}`,
  ],
  ['verbatim', snippet('verbatim')],
])
