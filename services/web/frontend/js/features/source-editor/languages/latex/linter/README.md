# How the Ace latex linter works

The purpose of the linter is to check the following

- each open environment is closed in the correct order
  - `\begin` .. `\end`
  - `$` ... `$` # inline math
  - `$$` ... `$$` # display math
  - `{` ... `}` # grouping commands
  - `\left` .. `\right` # bracket commands (in math-mode only)
- math-mode commands are only used in math-mode (e.g. `\alpha`, `^` and `_`)
- text-specific commands are only used outside math-mode (e.g. `\chapter` should not be used in math-mode)

The general approach of the ace linter is as following

- skip over all of the file apart from the relevant tokens
- iterate through the tokens keeping track of the current context (environment/math-mode)
- report an error if
  - a token is not allowed in the current context
  - an environment is closed incorrectly

# Implementation

The implementation has two main phases

1. Tokenise
2. InterpretTokens

The linter returns errors found in the InterpretTokens phase.

## Tokenise - finding tokens

The tokenizer starts from the beginning of the file, searching repeatedly for the next special character: `['\', '{', '}', '$', '&', '#', '^', '_', '~', '%']`.

When a special character is found, it is inspected and additional characters consumed according to the following TeX rules:

- `'\'` escape character: Handle TeX control sequences (`\foo`) and control symbols (`\@`).
  - followed by `[a-zA-Z]+`: it's a control sequence, consume whitespace after it
  - otherwise, it's a control symbol (single character)
- any other special character `['{', '}', '$', '&', '#', '^', '_', '~']`: push it as a token
- `'%'` comment: consume up to next newline.
  Special cases:
  - `%novalidate` disable validation in this file
  - `%begin novalidate`, `%end novalidate` disable validation in a region
- anything else: throw an error for an unexpected character

The content between special characters, and not consumed by any rules above or below, is marked as a `Text` token.

After this stage, we have a list of the tokens (with their positions) and text regions.

## InterpretTokens - from tokens to environments

This function iterates over the tokens, looking for groups or environments to match. Each environment command is pushed onto the `Environments` array. As part of this process other commands are interpreted in order to skip over them (for example `\newcommand{\foo}{\begin{equation}}` is valid and should not trigger an "unmatched environment" error.). We consume these commands using custom argument functions.

When we push an entry onto the `Environments` array we also keep track of the math mode (either `null`, `inline`, or `display`), and for some commands the mode of the next argument (`nextGroupMathMode`). For example, `\hbox` has `nextGroupMathMode` false since the next group is its argument `{...}` which will always be text.

### Custom argument functions

Tokens may be followed by various arguments, which can be optional. These are consumed by custom functions which look for the correct format:

- `read1arg`: read an argument `FOO` to a either form of command `\newcommand\FOO...` or `\newcommand{\FOO}...`. Also support optional `*` form `\newcommand*`.
- `readLetDefinition`: read a let command (the equals sign is optional) `\let\foo=\bar`, `\let\foo=TOKEN`, `\let\foo\bar`, `\let\foo\TOKEN`.
- `read1name`: read an environemt name `FOO` in `\newenvironment{FOO}...`, also handle names like `FOO_BAR`.
- `read1filename`: read a filename like `foo_bar.tex` (may include `_`)
- `readOptionalParams`: read an optional parameter `[N]` where `N` is a number, used for `\newcommand{\foo}[2]...` meaning 2 parameters. Allow for additional arguments like `[1][key=value,key=value]` and skip over arbitrary arguments `[xxx][yyy][\foo{zzz}]{...` up to the first `{..`
- `readOptionalGeneric`: read a single optional parameter `[foo]`
- `readOptionalDef`:skip over the optional arguments of a definition `\def\foo#1.#2(#3){this is the macro #1 #2 #3}` to start looking at text immediately after `\def` command.
- `readDefinition`: read a definition as in `\newcommand{\FOO}{DEFN}` or `\newcommand{\FOO} {DEF}` (optional whitespace). Look ahead for argument, consuming whitespace, the definition is read looking for balanced `{` ... `}` braces.
- `readVerb`: read a verbatim argument `\verb@foo@` or `\verb*@foo@` where `@` is any character except `*` for `\verb`, `foo` is any sequence excluding end-of-line and the delimiter. A space does work for `@`, contrary to latex documentation. Note: this is only an approximation, because we have already tokenised the input stream, and we should really do that taking into account the effect of verb. For example \verb|%| will get confused because % is then a character.
- `readUrl`: read a url argument `\url|foo|`, `\url{foo}` Note: this is only an approximation, because we have already tokenised the input stream, so anything after a comment character % on the current line will not be present in the input stream.

### Token interpretation

The following tokens trigger special handling, either by starting or closing a group or environment, being a command that must be intepreted (to skip over arguments) or having special properties (such as only being permissible in certain environments).

- `{` and `}` handle open and close group as a type of environment
- `\begin` and `\end` followed by a text token, taken as the environment name
  - also allow repeated text tokens separated by `_` (e.g like `\begin{new_major_theorem}`)
- Parse bracket commands, treated as an environment since they must match
  - `\left` and `\right` must be followed by one of `(){}[]<>/|\.`
- `\(` ... `\)` and `\[` ... `\]` handle open and close math-modes as a type of environment
- Parse command definitions in a limited way, to avoid falsely reporting errors from unmatched environments in the command definition e.g. `\newcommand{\foo}{\begin{equation}}` is valid and should not trigger an "unmatched environment" error.
  - `newcommand`, `renewcommand`, `DeclareRobustCommand`: read1arg readOptionalParams readDefinition
  - `def`: read1arg readOptionalDef readDefinition
  - `let`: readLetDefinition
  - `newcolumntype` read1name readOptionalParams readDefinition
  - `newenvironment`, `renewenvironment` read1name readOptionalParams readDefinition(open) readDefinition(close)
- Parse special commands
  - `verb`: readVerb (`\verb|....|` where `|` is any char)
  - `url`: readUrl (`\url{...}` or `\url|....|` where `|` is any char)
  - `input`: read1filename
- Parse text mode commands - the next group will be in text mode regardless
  - `hbox`, `text`, `mbox`, `footnote`, `intertext`, `shortintertext`, `textnormal`, `tag`, `reflectbox`, `textrm`
- Parse graphics commands
  - `tikz`: readOptionalGeneric
  - `rotatebox`, `scalebox`, `feynmandiagram`: readOptionalGeneric readDefinition
  - `resizebox`: readOptionalGeneric readDefinition(width) readDefinition(height)
- Parse math definition commands
  - `DeclareMathOperator`: readDefinition(first arg) readDefinition(second arg)
  - `DeclarePairedDelimiter`: readDefinition(first arg) readDefinition(second arg) readDefinition(third arg)
- Math-mode commands
  - `(alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega)`: can only be used in math mode
- Text-mode commands
  - `(chapter|section|subsection|subsubsection)`: cannot be used in math mode
- Any other unrecognised command
  - `\[a-z]+`: if we see an unknown command \foo{...}{...} put the math mode for the next group into the 'undefined' state, because we do not know what math mode an arbitrary macro will use for its arguments. In the math mode 'undefined' state we don't report errors when we encounter math or text commands.
- Math-mode delimiters
  - `$$` - display math environment
  - `$` - inline math environment
- Subscript and superscript (must be inside math-mode)
  - `^` and `_`: check for mathmode assuming environments are correct

### Environment handling

- must be outside math mode: `(document|figure|center|enumerate|itemize|table|abstract|proof|lemma|theorem|definition|proposition|corollary|remark|notation|thebibliography)`
- must be inside math mode: `(array|gathered|split|aligned|alignedat)\*?`
- must be outside math mode but starts it: `(math|displaymath|equation|eqnarray|multline|align|gather|flalign|alignat)\*?`
- start a verbatim environment: `(verbatim|boxedverbatim|lstlisting|minted|Verbatim)`. Any errors occurring in a verbatim environment are ignored.

### Special cases

If we encounter any tokens matching `(be|beq|beqa|bea)` or `(ee|eeq|eeqn|eeqa|eeqan|eea)` we filter out all errors relating to math-mode violations, since these are common user-defined macros to replace `\begin{equation}` etc.
