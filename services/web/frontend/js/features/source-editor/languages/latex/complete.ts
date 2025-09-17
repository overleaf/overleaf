import {
  CompletionContext,
  CompletionResult,
  CompletionSource,
  ifIn,
} from '@codemirror/autocomplete'
import { customEndCompletions } from './completions/environments'
import { customCommandCompletions } from './completions/doc-commands'
import {
  customEnvironmentCompletions,
  findEnvironmentsInDoc,
} from './completions/doc-environments'
import { Completions } from './completions/types'
import { buildReferenceCompletions } from './completions/references'
import { buildPackageCompletions } from './completions/packages'
import { buildLabelCompletions } from './completions/labels'
import { buildIncludeCompletions } from './completions/include'
import { buildBibliographyStyleCompletions } from './completions/bibliography-styles'
import { buildClassCompletions } from './completions/classes'
import { buildAllCompletions } from './completions'
import {
  ifInType,
  cursorIsAtBeginEnvironment,
  cursorIsAtEndEnvironment,
} from '../../utils/tree-query'
import {
  applySnippet,
  extendOverUnpairedClosingBrace,
} from './completions/apply'
import { snippet } from './completions/data/environments'
import { syntaxTree } from '@codemirror/language'

function blankCompletions(): Completions {
  return {
    bibliographies: [],
    bibliographyStyles: [],
    classes: [],
    commands: [],
    graphics: [],
    includes: [],
    labels: [],
    packages: [],
    references: [],
  }
}

export function getCompletionMatches(context: CompletionContext) {
  // NOTE: [^\\] is needed to match commands inside the parameters of other commands
  const matchBefore = context.explicit
    ? context.matchBefore(/(?:^|\\)[^\\]*(\[[^\]]*])?[^\\]*/) // don't require a backslash if opening on explicit "startCompletion" keypress
    : context.matchBefore(/\\?\\[^\\]*(\[[^\]]*])?[^\\]*/)

  if (!matchBefore) {
    return null
  }

  // ignore some matches when not opening on explicit "startCompletion" keypress
  if (!context.explicit) {
    // ignore matches that end with two backslashes. \\ shouldn't show the autocomplete as it's used for line break.
    if (/\\\\$/.test(matchBefore.text)) {
      return null
    }

    // ignore matches that end with whitespace, unless after a comma
    // e.g. \item with a trailing space shouldn't show the autocomplete.
    if (/[^,\s]\s+$/.test(matchBefore.text)) {
      return null
    }
  }

  const multipleArgumentMatcher =
    /^(?<before>\\(?<command>\w+)\*?(?<arguments>(\[[^\]]*?]|\{[^}]*?})+)?{)(?<existing>([^}]+\s*,\s*)+)?(?<prefix>[^}]+)?$/
  // If this is a command with multiple comma-separated arguments, show deduplicated available completions
  const match = matchBefore.text.match(multipleArgumentMatcher)

  return { match, matchBefore }
}

export function getCompletionDetails(
  match: RegExpMatchArray,
  matchBefore: {
    from: number
    to: number
    text: string
  }
) {
  let { before, command, existing } = match.groups as {
    before?: string
    command: string
    existing?: string
  }

  command = command.toLowerCase()

  const existingKeys = existing ? splitExistingKeys(existing) : []

  const from =
    matchBefore.from + (before?.length || 0) + (existing?.length || 0)
  const validFor = /[^}\s]*/

  return { command, existingKeys, from, validFor }
}

export type CompletionBuilderOptions = {
  context: CompletionContext
  completions: Completions
  match: RegExpMatchArray
  matchBefore: { from: number; to: number; text: string }
  existingKeys: string[]
  from: number
  validFor: RegExp
  before: string
}

export const makeArgumentCompletionSource = (
  ifInSpec: string[],
  builder: (
    builderOptions: CompletionBuilderOptions
  ) => CompletionResult | null | Promise<CompletionResult | null>
): CompletionSource => {
  const completionSource: CompletionSource = (context: CompletionContext) => {
    const completionMatches = getCompletionMatches(context)

    if (!completionMatches) {
      return null
    }

    const completions: Completions = blankCompletions()

    const { match, matchBefore } = completionMatches

    if (!match) {
      return null
    }

    const { before } = match.groups as {
      before: string
    }

    const { existingKeys, from, validFor } = getCompletionDetails(
      match,
      matchBefore
    )

    return builder({
      completions,
      context,
      match,
      matchBefore,
      before,
      existingKeys,
      from,
      validFor,
    })
  }
  return ifIn(ifInSpec, completionSource)
}

const splitExistingKeys = (text: string) =>
  text
    .split(',')
    .map(key => key.trim())
    .filter(Boolean)

export const makeMultipleArgumentCompletionSource = (
  ifInSpec: string[],
  builder: (
    builderOptions: Pick<
      CompletionBuilderOptions,
      'completions' | 'context' | 'existingKeys' | 'from' | 'validFor'
    >
  ) => ReturnType<CompletionSource>
): CompletionSource => {
  const completionSource: CompletionSource = (context: CompletionContext) => {
    const token = context.tokenBefore(ifInSpec)

    if (!token) {
      return null
    }

    // match multiple comma-separated arguments, up to the last separator
    const existing = token.text.match(/^\{(.+\s*,\s*)?.*$/)?.[1] ?? ''

    return builder({
      completions: blankCompletions(),
      context,
      existingKeys: splitExistingKeys(existing),
      from: token.from + 1 + existing.length,
      validFor: /[^}\s]*/,
    })
  }
  return ifIn(ifInSpec, completionSource)
}

export const bibKeyArgumentCompletionSource: CompletionSource =
  makeMultipleArgumentCompletionSource(
    ['BibKeyArgument'],
    ({ completions, context, from, validFor, existingKeys }) => {
      buildReferenceCompletions(completions, context)

      return {
        from,
        validFor,
        options: completions.references.filter(
          item => !existingKeys.includes(item.label)
        ),
      }
    }
  )

export const refArgumentCompletionSource: CompletionSource =
  makeMultipleArgumentCompletionSource(
    ['RefArgument'],
    ({ completions, context, from, validFor, existingKeys }) => {
      buildLabelCompletions(completions, context)

      return {
        from,
        validFor,
        options: completions.labels.filter(
          item => !existingKeys.includes(item.label)
        ),
      }
    }
  )

export const packageArgumentCompletionSource: CompletionSource =
  makeMultipleArgumentCompletionSource(
    ['PackageArgument'],
    ({ completions, context, from, validFor, existingKeys }) => {
      buildPackageCompletions(completions, context)

      return {
        from,
        validFor,
        options: completions.packages.filter(
          item => !existingKeys.includes(item.label)
        ),
      }
    }
  )

export const inputArgumentCompletionSource: CompletionSource =
  makeArgumentCompletionSource(
    ['InputArgument', 'IncludeArgument', 'SubfileArgument'],
    ({ completions, context, from }) => {
      buildIncludeCompletions(completions, context)

      return {
        from,
        validFor: /^[^}]*/,
        options: completions.includes,
      }
    }
  )

export const includeGraphicsArgumentCompletionSource: CompletionSource =
  makeArgumentCompletionSource(
    ['IncludeGraphicsArgument'],
    ({ completions, context, from }) => {
      buildIncludeCompletions(completions, context)

      return {
        from,
        validFor: /^[^}]*/,
        options: completions.graphics,
      }
    }
  )

export const environmentNameCompletionSource: CompletionSource =
  makeArgumentCompletionSource(
    ['EnvNameGroup'],
    ({ completions, context, matchBefore, before }) => {
      if (cursorIsAtBeginEnvironment(context.state, context.pos)) {
        buildAllCompletions(completions, context)

        return {
          from: matchBefore.from,
          validFor: /^\\begin{\S*/,
          options: [
            ...completions.commands,
            ...customEnvironmentCompletions(context),
          ],
        }
      } else if (cursorIsAtEndEnvironment(context.state, context.pos)) {
        return {
          from: matchBefore.from + before.length,
          validFor: /^[^}]*/,
          options: customEndCompletions(context),
        }
      } else {
        return null
      }
    }
  )

export const documentClassArgumentCompletionSource: CompletionSource =
  makeArgumentCompletionSource(
    ['DocumentClassArgument'],
    ({ completions, from }) => {
      buildClassCompletions(completions)

      return {
        from,
        validFor: /^[^}]*/,
        options: completions.classes,
      }
    }
  )

export const bibliographyArgumentCompletionSource: CompletionSource =
  makeArgumentCompletionSource(
    ['BibliographyArgument'],
    ({ completions, context, from }) => {
      buildIncludeCompletions(completions, context)

      return {
        from,
        validFor: /^[^}]*/,
        options: completions.bibliographies,
      }
    }
  )

export const bibliographyStyleArgumentCompletionSource: CompletionSource =
  makeArgumentCompletionSource(
    ['BibliographyStyleArgument'],
    ({ completions, from }) => {
      buildBibliographyStyleCompletions(completions)

      return {
        from,
        validFor: /^[^}]*/,
        options: completions.bibliographyStyles,
      }
    }
  )

export const argumentCompletionSources: CompletionSource[] = [
  bibKeyArgumentCompletionSource,
  refArgumentCompletionSource,
  packageArgumentCompletionSource,
  inputArgumentCompletionSource,
  includeGraphicsArgumentCompletionSource,
  environmentNameCompletionSource,
  documentClassArgumentCompletionSource,
  bibliographyArgumentCompletionSource,
  bibliographyStyleArgumentCompletionSource,
]

const commandCompletionSource = (context: CompletionContext) => {
  const completionMatches = getCompletionMatches(context)

  if (!completionMatches) {
    return null
  }

  const { match, matchBefore } = completionMatches
  if (match) {
    // We're already in a command argument, bail out
    return null
  }

  const completions: Completions = blankCompletions()

  buildAllCompletions(completions, context)

  // Unknown commands
  const prefixMatcher = /^\\[^{\s]*$/
  const prefixMatch = matchBefore.text.match(prefixMatcher)
  if (prefixMatch) {
    return {
      from: matchBefore.from,
      validFor: prefixMatcher,
      options: [
        ...completions.commands,
        ...customCommandCompletions(context, completions.commands),
        ...customEnvironmentCompletions(context),
      ],
    }
  }

  // anything else (no validFor)
  return {
    from: matchBefore.to,
    options: [
      ...completions.commands,
      ...customCommandCompletions(context, completions.commands),
    ],
  }
}

export const inCommandCompletionSource: CompletionSource = ifInType(
  '$CtrlSeq',
  context => {
    return context.explicit ? null : commandCompletionSource(context)
  }
)

export const explicitCommandCompletionSource: CompletionSource = context => {
  return context.explicit ? commandCompletionSource(context) : null
}

/**
 * An additional completion source that handles two situations:
 *
 * 1. Typing the environment name within an already-complete `\begin{…}` command.
 * 2. After typing the closing brace of a complete `\begin{foo}` command, where the environment
 * isn't previously known, leaving the cursor after the closing brace.
 */
export const beginEnvironmentCompletionSource: CompletionSource = context => {
  const beginEnvToken = context.tokenBefore(['BeginEnv'])
  if (!beginEnvToken) {
    return null
  }

  const beginEnv = syntaxTree(context.state).resolveInner(
    beginEnvToken.from,
    1
  ).parent
  if (!beginEnv?.type.is('BeginEnv')) {
    return null
  }

  const envNameGroup = beginEnv.getChild('EnvNameGroup')
  if (!envNameGroup) {
    return null
  }

  const envName = envNameGroup.getChild('$EnvName')
  if (!envName) {
    return null
  }

  const name = context.state.sliceDoc(envName.from, envName.to)

  // if not directly after `\begin{…}`, exclude known environments
  if (context.pos !== envNameGroup.to) {
    const existingEnvironmentNames = findEnvironmentsInDoc(context)
    if (existingEnvironmentNames.has(name)) {
      return null
    }
  }

  const completion = {
    label: `\\begin{${name}} …`,
    apply: applySnippet(snippet(name)),
    extend: extendOverUnpairedClosingBrace,
    boost: -99,
  }

  return {
    from: beginEnvToken.from,
    options: [completion],
  }
}
