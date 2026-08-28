import { expect, it, describe } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  DEFAULT_WRAPPER,
  EXPORT_WRAPPERS,
  splitEquation,
  wrapLatex,
} from '../../../frontend/js/utils/equation-export.mjs'
import {
  SEARCH_RESULT_LIMIT,
  searchCommands,
} from '../../../frontend/js/utils/command-search.mjs'
import {
  environmentTemplates,
  latexCommands,
  matrixTemplates,
} from '../../../frontend/js/data/latex-commands.mjs'

describe('wrapLatex', () => {
  it('returns the body unchanged for plain', () => {
    expect(wrapLatex('a + b', 'plain')).toBe('a + b')
    expect(wrapLatex('a + b')).toBe('a + b')
  })

  it('wraps in an equation environment', () => {
    expect(wrapLatex('x = 1', 'equation')).toBe(
      '\\begin{equation}\nx = 1\n\\end{equation}'
    )
  })

  it('wraps in an eqnarray environment', () => {
    expect(wrapLatex('x = 1', 'eqnarray')).toBe(
      '\\begin{eqnarray}\nx = 1\n\\end{eqnarray}'
    )
  })

  it('wraps inline math in $...$', () => {
    expect(wrapLatex('x = 1', 'inline')).toBe('$x = 1$')
  })

  it('wraps display math in \\[...\\]', () => {
    expect(wrapLatex('x = 1', 'display')).toBe('\\[x = 1\\]')
  })

  it('falls back to the plain body for unknown wrappers', () => {
    expect(wrapLatex('x = 1', 'nope')).toBe('x = 1')
  })

  it('handles empty bodies', () => {
    expect(wrapLatex('', 'inline')).toBe('$$')
    expect(wrapLatex('', 'equation')).toBe('\\begin{equation}\n\n\\end{equation}')
  })

  it('trims leading and trailing whitespace', () => {
    expect(wrapLatex('  x^2  ', 'inline')).toBe('$x^2$')
    expect(wrapLatex('\t x = 1\n', 'display')).toBe('\\[x = 1\\]')
  })

  it('trims MathLive text-space tokens at both ends', () => {
    expect(wrapLatex('x^2\\text{ }', 'inline')).toBe('$x^2$')
    expect(wrapLatex('\\text{ }x^2', 'plain')).toBe('x^2')
    expect(wrapLatex('  \\text{ }x^2\\text{ }  ')).toBe('x^2')
  })

  it('keeps interior text-space tokens intact', () => {
    expect(wrapLatex('a\\text{ }+\\text{ }b', 'plain')).toBe(
      'a\\text{ }+\\text{ }b'
    )
  })

  it('exposes a stable list of wrappers', () => {
    expect(EXPORT_WRAPPERS).toEqual([
      'plain',
      'equation',
      'eqnarray',
      'inline',
      'display',
    ])
  })
})

describe('splitEquation', () => {
  it('defaults to the inline wrapper for bare bodies', () => {
    expect(DEFAULT_WRAPPER).toBe('inline')
    expect(splitEquation('x = 1')).toEqual({ body: 'x = 1', wrapper: 'inline' })
  })

  it('splits inline math fences', () => {
    expect(splitEquation('$x = 1$')).toEqual({
      body: 'x = 1',
      wrapper: 'inline',
    })
  })

  it('splits $$...$$ display math', () => {
    expect(splitEquation('$$x = 1$$')).toEqual({
      body: 'x = 1',
      wrapper: 'display',
    })
  })

  it('splits \\[...] display math', () => {
    expect(splitEquation('\\[x = 1\\]')).toEqual({
      body: 'x = 1',
      wrapper: 'display',
    })
  })

  it('splits equation environments', () => {
    expect(
      splitEquation('\\begin{equation}\nx = 1\n\\end{equation}')
    ).toEqual({ body: 'x = 1', wrapper: 'equation' })
  })

  it('maps starred equation environments to the unstarred wrapper', () => {
    expect(splitEquation('\\begin{equation*}x\\end{equation*}')).toEqual({
      body: 'x',
      wrapper: 'equation',
    })
  })

  it('splits eqnarray environments', () => {
    expect(splitEquation('\\begin{eqnarray}a & b\\end{eqnarray}')).toEqual({
      body: 'a & b',
      wrapper: 'eqnarray',
    })
  })

  it('trims whitespace around the body', () => {
    expect(splitEquation('  $ x $  ')).toEqual({ body: 'x', wrapper: 'inline' })
    expect(splitEquation('\\[ x \\]')).toEqual({ body: 'x', wrapper: 'display' })
  })

  it('falls back to the inline wrapper for unrecognised content', () => {
    expect(splitEquation('a \\\\ b')).toEqual({
      body: 'a \\\\ b',
      wrapper: 'inline',
    })
  })

  it('round-trips: wrapLatex(split(x)) reproduces the canonical form', () => {
    const cases = [
      ['$x = 1$', 'inline'],
      ['$$x = 1$$', 'display'],
      ['\\[x = 1\\]', 'display'],
      ['\\begin{equation}\nx = 1\n\\end{equation}', 'equation'],
      ['\\begin{eqnarray}a & b\\end{eqnarray}', 'eqnarray'],
      ['x = 1', 'inline'],
    ]
    for (const [src, expectedWrapper] of cases) {
      const split = splitEquation(src)
      expect(split.wrapper).toBe(expectedWrapper)
      expect(wrapLatex(split.body, split.wrapper)).toBe(
        wrapLatex(split.body, expectedWrapper)
      )
    }
  })
})

describe('searchCommands', () => {
  const commands = [
    { cmd: '\\alpha', desc: 'Greek alpha' },
    { cmd: '\\beta', desc: 'Greek beta' },
    { cmd: '\\textbf', desc: 'Bold text', insert: '\\textbf{...}' },
    null,
    { desc: 'no command field' },
  ]

  it('returns no results for an empty query', () => {
    expect(searchCommands(commands, '')).toEqual([])
    expect(searchCommands(commands, '   ')).toEqual([])
    expect(searchCommands(commands, undefined)).toEqual([])
  })

  it('matches commands case-insensitively', () => {
    expect(searchCommands(commands, 'ALPH')).toEqual([
      { cmd: '\\alpha', desc: 'Greek alpha' },
    ])
  })

  it('matches descriptions', () => {
    expect(searchCommands(commands, 'bold')).toEqual([
      { cmd: '\\textbf', desc: 'Bold text', insert: '\\textbf{...}' },
    ])
  })

  it('matches insert snippets', () => {
    expect(searchCommands(commands, 'textbf{')).toHaveLength(1)
  })

  it('does not crash on malformed entries', () => {
    expect(searchCommands(commands, 'greek')).toHaveLength(2)
    expect(searchCommands(nonEnumerableCommands(), 'x')).toEqual([])
  })

  it('respects the result limit', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({
      cmd: `\\cmd${i}`,
      desc: `Command ${i}`,
    }))
    expect(searchCommands(many, 'cmd')).toHaveLength(SEARCH_RESULT_LIMIT)
    expect(searchCommands(many, 'cmd', { limit: 5 })).toHaveLength(5)
  })

  it('is safe on empty or non-array inputs', () => {
    expect(searchCommands([], 'x')).toEqual([])
    expect(searchCommands(undefined, 'x')).toEqual([])
  })
})

function nonEnumerableCommands() {
  return { 0: { cmd: '\\a', desc: 'a' } }
}

describe('mathlive version pin', () => {
  it('keeps the fontsDirectory path in sync with the installed mathlive', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const findPkg = () => {
      let dir = here
      for (;;) {
        const candidate = join(dir, 'node_modules', 'mathlive', 'package.json')
        if (existsSync(candidate)) {
          return JSON.parse(readFileSync(candidate, 'utf8'))
        }
        const parent = dirname(dir)
        if (parent === dir) {
          throw new Error('mathlive package not found in any ancestor node_modules')
        }
        dir = parent
      }
    }
    const mathlivePkg = findPkg()
    const componentPath = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../frontend/js/components/mathlive-input.tsx'
    )
    const source = readFileSync(componentPath, 'utf8')
    const pinned = source.match(/mathlive-(\d+\.\d+\.\d+)/)
    expect(pinned, 'mathlive-input.tsx must pin the mathlive version').not.toBeNull()
    if (pinned) {
      expect(pinned[1]).toBe(mathlivePkg.version)
    }
  })
})

describe('command and template data', () => {
  it('provides a non-empty command list', () => {
    expect(latexCommands.length).toBeGreaterThan(100)
  })

  it('has well-formed command entries', () => {
    for (const entry of latexCommands) {
      expect(typeof entry.cmd).toBe('string')
      expect(entry.cmd.length).toBeGreaterThan(0)
      expect(typeof entry.desc).toBe('string')
      expect(entry.desc.length).toBeGreaterThan(0)
    }
  })

  it('has unique command names', () => {
    const cmds = latexCommands.map(e => e.cmd)
    expect(new Set(cmds).size).toBe(cmds.length)
  })

  it('has well-formed matrix templates', () => {
    expect(matrixTemplates.length).toBeGreaterThan(0)
    for (const t of matrixTemplates) {
      expect(typeof t.name).toBe('string')
      expect(t.latex).toContain('\\begin{')
      expect(t.latex).toContain('\\end{')
    }
  })

  it('has well-formed environment templates', () => {
    expect(environmentTemplates.length).toBeGreaterThan(0)
    for (const t of environmentTemplates) {
      expect(typeof t.name).toBe('string')
      expect(typeof t.latex).toBe('string')
      expect(t.latex.length).toBeGreaterThan(0)
    }
  })
})
