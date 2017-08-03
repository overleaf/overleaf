define () ->
    noArgumentCommands = [
        'item', 'hline', 'lipsum', 'centering', 'noindent', 'textwidth', 'draw',
        'maketitle', 'newpage', 'verb', 'bibliography', 'fi', 'hfill', 'par',
        'in', 'sum', 'cdot', 'alpha', 'ldots', 'else', 'linewidth', 'left',
        'right', 'today', 'clearpage', 'newline', 'endinput', 'mu',
        'tableofcontents', 'vfill', 'bigskip', 'fill', 'cleardoublepage',
    ]
    singleArgumentCommands = [
        'chapter', 'usepackage', 'section', 'label', 'textbf', 'subsection',
        'vspace', 'cite', 'textit', 'documentclass', 'includegraphics', 'input',
        'emph','caption', 'ref', 'title', 'author', 'texttt', 'include',
        'hspace', 'bibitem', 'url', 'large', 'subsubsection', 'textsc', 'date',
        'footnote', 'small', 'thanks', 'underline', 'graphicspath', 'pageref',
        'section*', 'subsection*', 'subsubsection*', 'sqrt', 'text',
        'normalsize', 'Large', 'paragraph', 'pagestyle', 'thispagestyle',
        'bibliographystyle',
    ]
    doubleArgumentCommands = [
        'newcommand', 'frac', 'renewcommand', 'setlength', 'href', 'newtheorem',
    ]
    tripleArgumentCommands = [
        'addcontentsline', 'newacronym', 'multicolumn'
    ]
    special = ['def', 'let', 'LaTeX']

    noArgumentCommands = for com in noArgumentCommands
        {
            caption: "\\#{com}"
            snippet: "\\#{com}"
            meta: "cmd"
        }
    singleArgumentCommands = for com in singleArgumentCommands
        {
            caption: "\\#{com}{}"
            snippet: "\\#{com}{$1}"
            meta: "cmd"
        }
    doubleArgumentCommands = for com in doubleArgumentCommands
        {
            caption: "\\#{com}{}{}"
            snippet: "\\#{com}{$1}{$2}"
            meta: "cmd"
        }
    tripleArgumentCommands = for com in tripleArgumentCommands
        {
            caption: "\\#{com}{}{}{}"
            snippet: "\\#{com}{$1}{$2}{$3}"
            meta: "cmd"
        }
    special = for com in special
        if com == 'def'
            { #should be improved
                caption: "\\def{}"
                snippet: "\\def$1{$2}"
                meta: "cmd"
            }
        else if com == 'let'
            { #should be improved
                caption: "\\let"
                snippet: "\\let"
                meta: "cmd"
            }
        else if com == 'LaTeX'
            {
                caption: "\\LaTeX{}"
                snippet: "\\LaTeX{}"
                meta: "cmd"
            }

    staticCommands = [].concat(noArgumentCommands,
                               singleArgumentCommands,
                               doubleArgumentCommands,
                               tripleArgumentCommands,
                               special)

    class StaticSuggestionManager
        getCompletions: (editor, session, pos, prefix, callback) ->
            callback null, staticCommands

    return StaticSuggestionManager
