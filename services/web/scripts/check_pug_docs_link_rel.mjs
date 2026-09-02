// @ts-check
//
// Scans .pug templates for links to docs.overleaf.com that open in a new tab
// (target='_blank') but are missing rel='noopener noreferrer', in both real
// anchor tags (`a(href=... target='_blank')`) and the `{name: 'a', attrs: {...}}`
// objects passed to translate() via `!{...}` interpolation.
//
// This is a plain text/regex scan, not a full pug parse, so it assumes anchor
// attribute values don't themselves contain parentheses or braces - true for
// every usage in this codebase today. See PR #35184 review discussion.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = path.join(__dirname, '..')

const DOCS_HOST = 'docs.overleaf.com'
const REQUIRED_REL_TOKENS = ['noopener', 'noreferrer']

/**
 * @param {string | undefined} rel
 */
function hasRequiredRel(rel) {
  const tokens = (rel || '').toLowerCase().split(/\s+/).filter(Boolean)
  return REQUIRED_REL_TOKENS.every(token => tokens.includes(token))
}

/**
 * @param {string} content
 * @param {number} index
 */
function lineOf(content, index) {
  return content.slice(0, index).split('\n').length
}

/**
 * @param {string} dir
 * @param {string[]} out
 * @returns {string[]}
 */
function findPugFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      findPugFiles(full, out)
    } else if (entry.name.endsWith('.pug')) {
      out.push(full)
    }
  }
  return out
}

function findViewDirs() {
  const dirs = [path.join(ROOT, 'app/views')]
  const modulesDir = path.join(ROOT, 'modules')
  if (fs.existsSync(modulesDir)) {
    for (const entry of fs.readdirSync(modulesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const viewsDir = path.join(modulesDir, entry.name, 'app/views')
      if (fs.existsSync(viewsDir)) dirs.push(viewsDir)
    }
  }
  return dirs
}

/**
 * @param {string} attrsText
 * @param {string} file
 * @param {number} line
 * @param {string[]} violations
 */
function checkAttrsText(attrsText, file, line, violations) {
  const hrefMatch = attrsText.match(/href\s*[=:]\s*(['"])(.*?)\1/)
  const href = hrefMatch?.[2]
  if (!href || !href.includes(DOCS_HOST)) return

  const targetMatch = attrsText.match(/target\s*[=:]\s*(['"])(.*?)\1/)
  const target = targetMatch?.[2]
  if (!target || target.toLowerCase() !== '_blank') return

  const relMatch = attrsText.match(/\brel\s*[=:]\s*(['"])(.*?)\1/)
  const rel = relMatch?.[2]
  if (!hasRequiredRel(rel)) {
    violations.push(
      `${file}:${line}: link to ${href} opens in a new tab but is missing rel="noopener noreferrer" (found: ${
        rel ? `"${rel}"` : 'none'
      })`
    )
  }
}

// Real pug anchor tags, e.g. `a(href=... target='_blank')` or
// `a.btn.btn-primary(href=... target='_blank')`, including ones whose
// attributes span multiple lines.
/**
 * @param {string} content
 * @param {string} file
 * @param {string[]} violations
 */
function checkAnchorTags(content, file, violations) {
  const re = /\ba(?:[.#][\w-]+)*\(([\s\S]*?)\)/g
  for (const match of content.matchAll(re)) {
    checkAttrsText(match[1], file, lineOf(content, match.index), violations)
  }
}

// `{name: 'a', attrs: {href: ..., target: '_blank'}}` objects embedded in
// translate() calls via `!{...}` interpolation.
/**
 * @param {string} content
 * @param {string} file
 * @param {string[]} violations
 */
function checkEmbeddedAnchorObjects(content, file, violations) {
  // Matches the outer `{name: 'a', attrs: {...}}` object with exactly one level
  // of nesting for the attrs sub-object (attrs itself has no nested braces).
  const re = /\{[^{}]*attrs\s*:\s*\{([^{}]*)\}[^{}]*\}/g
  for (const match of content.matchAll(re)) {
    const outer = match[0]
    if (!/name\s*:\s*(['"])a\1/.test(outer)) continue
    checkAttrsText(match[1], file, lineOf(content, match.index), violations)
  }
}

function main() {
  const files = findViewDirs().flatMap(dir => findPugFiles(dir))
  /** @type {string[]} */
  const violations = []

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8')
    if (!content.includes(DOCS_HOST)) continue
    const relFile = path.relative(ROOT, file)
    checkAnchorTags(content, relFile, violations)
    checkEmbeddedAnchorObjects(content, relFile, violations)
  }

  if (violations.length > 0) {
    console.error(
      'Found docs.overleaf.com link(s) opened in a new tab without rel="noopener noreferrer":\n'
    )
    for (const violation of violations) {
      console.error(`  ${violation}`)
    }
    console.error(
      `\n${violations.length} violation(s). Add rel='noopener noreferrer' to the link(s) above.`
    )
    process.exit(1)
  }

  console.log(`Checked ${files.length} pug template(s) - no violations found.`)
}

main()
