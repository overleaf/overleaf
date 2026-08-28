/**
 * Wraps a LaTeX equation body with an environment / math fence for
 * insertion into the Overleaf document. `latex` is the content of the
 * editor (MathLive or raw textarea), `wrapper` selects the export form.
 *
 * Leading/trailing whitespace and trailing text-space tokens produced
 * by MathLive (e.g. a cursor space rendered as `\text{ }`) are trimmed
 * before wrapping, so the exported equation is clean both sides.
 */
export const EXPORT_WRAPPERS = ['plain', 'equation', 'eqnarray', 'inline', 'display']

// Default export form for content with no detectable fence
export const DEFAULT_WRAPPER = 'inline'

// MathLive renders a typed space as a text-space token
const LATEX_SPACE_TOKEN = '\\text{ }'

function trimLatex(latex) {
  let body = String(latex).trim()
  while (body.startsWith(LATEX_SPACE_TOKEN)) {
    body = body.slice(LATEX_SPACE_TOKEN.length).trimStart()
  }
  while (body.endsWith(LATEX_SPACE_TOKEN)) {
    body = body.slice(0, -LATEX_SPACE_TOKEN.length).trimEnd()
  }
  return body
}

export function wrapLatex(latex, wrapper) {
  const body = trimLatex(latex)
  switch (wrapper) {
    case 'equation':
      return `\\begin{equation}\n${body}\n\\end{equation}`
    case 'eqnarray':
      return `\\begin{eqnarray}\n${body}\n\\end{eqnarray}`
    case 'inline':
      return `$${body}$`
    case 'display':
      return `\\[${body}\\]`
    case 'plain':
    default:
      return body
  }
}

/**
 * Split an equation *as it appears in the document* into its bare body and
 * the wrapper (env / fence) that surrounds it, so the modal can show a
 * coherent (body, environment) pair. `wrapLatex(body, wrapper)` then
 * reproduces the original equation. Starred environments map to the
 * unstarred wrapper (the environment kind is preserved).
 *
 * Pure and unit-testable; no DOM or regex catastrophic-backtracking risk.
 * Returns { body: string, wrapper: ExportWrapper }.
 */
export function splitEquation(latex) {
  let s = String(latex ?? '').trim()

  // \begin{eqnarray[*]} ... \end{eqnarray[*]}
  let m = s.match(/^\\begin\{(eqnarray\*?)\}([\s\S]*)\\end\{\1\}\s*$/)
  if (m) return { body: m[2].trim(), wrapper: 'eqnarray' }

  // \begin{equation[*]} ... \end{equation[*]}
  m = s.match(/^\\begin\{(equation\*?)\}([\s\S]*)\\end\{\1\}\s*$/)
  if (m) return { body: m[2].trim(), wrapper: 'equation' }

  // \[ ... \]
  if (/^\\\[/.test(s) && s.endsWith('\\]') && s.length >= 4) {
    return { body: s.slice(2, -2).trim(), wrapper: 'display' }
  }

  // $$ ... $$  (before the single-$ case so it is not swallowed)
  if (s.startsWith('$$') && s.endsWith('$$') && s.length >= 4) {
    return { body: s.slice(2, -2).trim(), wrapper: 'display' }
  }

  // $ ... $
  if (s.startsWith('$') && s.endsWith('$') && s.length >= 2) {
    return { body: s.slice(1, -1).trim(), wrapper: 'inline' }
  }

  // No fence detected: treat as a bare body with the default wrapper
  return { body: s, wrapper: DEFAULT_WRAPPER }
}
