// French typographic spacing rules for JSON string values.
// Per https://typographisme.net/post/Les-espaces-typographiques-et-le-web
//   - NNBSP  before ? ! ;
//   - NBSP   before :
//   - NBSP   inside guillemets (after «, before ») — keeps the
//     guillemet attached to its content so it cannot be orphaned at a
//     line break
//   - NNBSP  between digit groups (thousands separator)
//   - NBSP   between a number and a following word/unit (50 Mo, 5 jours)
//   - NBSP   before %
//   - point médian "·" instead of parenthetical (e) for inclusive writing

const NBSP = ' '
const NNBSP = ' '

function autoFix(value) {
  let v = value
  // Normalize whitespace before ? ! ; to NNBSP
  v = v.replace(/\s*([?!;])/g, `${NNBSP}$1`)
  v = v.replace(/([^\s])([?!;])/g, `$1${NNBSP}$2`)
  // Normalize whitespace before : (after a letter, not before /) to NBSP
  v = v.replace(/(\p{L})\s*:(?!\/)/gu, `$1${NBSP}:`)
  // NBSP after «
  v = v.replace(/«\s*/g, `«${NBSP}`)
  // NBSP before »
  v = v.replace(/\s*»/g, `${NBSP}»`)
  // NNBSP between digits (thousands separator)
  v = v.replace(/(\d)\s+(\d)/g, `$1${NNBSP}$2`)
  // NBSP between digit and following letter (number + unit/word)
  v = v.replace(/(\d)\s+(\p{L})/gu, `$1${NBSP}$2`)
  // NBSP before %
  v = v.replace(/(\d)\s*%/g, `$1${NBSP}%`)
  return v
}

function lint(value) {
  const violations = []
  for (const m of value.matchAll(/(.)([?!;])/g)) {
    if (m[1] !== NNBSP) {
      violations.push({
        message: `expected NNBSP before "${m[2]}", got ${JSON.stringify(m[1])}`,
        fixable: true,
      })
    }
  }
  for (const m of value.matchAll(/(\p{L})(\s*):(?!\/)/gu)) {
    if (m[2] !== NBSP) {
      violations.push({
        message: `expected NBSP before ":" after letter ${JSON.stringify(m[1])}, got ${JSON.stringify(m[2])}`,
        fixable: true,
      })
    }
  }
  for (const m of value.matchAll(/«(.)/g)) {
    if (m[1] !== NBSP) {
      violations.push({
        message: `expected NBSP after "«", got ${JSON.stringify(m[1])}`,
        fixable: true,
      })
    }
  }
  for (const m of value.matchAll(/(.)»/g)) {
    if (m[1] !== NBSP) {
      violations.push({
        message: `expected NBSP before "»", got ${JSON.stringify(m[1])}`,
        fixable: true,
      })
    }
  }
  for (const m of value.matchAll(/(\d)(\s)(\d)/g)) {
    if (m[2] !== NNBSP) {
      violations.push({
        message: `expected NNBSP between digits "${m[1]}${m[3]}", got ${JSON.stringify(m[2])}`,
        fixable: true,
      })
    }
  }
  for (const m of value.matchAll(/(\d)(\s)(\p{L})/gu)) {
    if (m[2] !== NBSP) {
      violations.push({
        message: `expected NBSP between digit "${m[1]}" and "${m[3]}", got ${JSON.stringify(m[2])}`,
        fixable: true,
      })
    }
  }
  for (const m of value.matchAll(/(\d)(\s*)%/g)) {
    if (m[2] !== NBSP) {
      violations.push({
        message: `expected NBSP before "%" after "${m[1]}", got ${JSON.stringify(m[2])}`,
        fixable: true,
      })
    }
  }
  if (value.includes('(e)')) {
    violations.push({
      message:
        'expected point médian "·" instead of "(e)" for inclusive writing',
      fixable: false, // suggestion-only
    })
  }
  return violations
}

module.exports = {
  meta: {
    type: 'problem',
    fixable: 'code',
    hasSuggestions: true,
    docs: {
      description:
        'Enforce French typographic spacing in JSON string values (NNBSP before ? ! ;, NBSP before : and inside « », etc.).',
    },
    schema: [],
  },
  create(context) {
    return {
      Member(node) {
        if (node.value.type !== 'String') return
        const original = node.value.value
        const violations = lint(original)
        if (violations.length === 0) return

        const fixed = autoFix(original)
        const replacement = JSON.stringify(fixed)
        const inclusiveSuggestion = original.includes('(e)')
          ? JSON.stringify(original.replace(/\(e\)/g, '·e'))
          : null

        for (const v of violations) {
          context.report({
            node: node.value,
            message: v.message,
            ...(v.fixable && fixed !== original
              ? {
                  fix(fixer) {
                    return fixer.replaceText(node.value, replacement)
                  },
                }
              : {}),
            ...(!v.fixable && inclusiveSuggestion
              ? {
                  suggest: [
                    {
                      desc: 'Replace "(e)" with "·e"',
                      fix(fixer) {
                        return fixer.replaceText(
                          node.value,
                          inclusiveSuggestion
                        )
                      },
                    },
                  ],
                }
              : {}),
          })
        }
      },
    }
  },
}
