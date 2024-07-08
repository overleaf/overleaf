import { CompletionContext, snippet } from '@codemirror/autocomplete'

type Environment = {
  name: string
  requiredAttributes: string[]
}

const environments: Environment[] = [
  {
    name: 'article',
    requiredAttributes: ['author', 'title', 'journal', 'year'],
  },
  {
    name: 'book',
    requiredAttributes: ['author', 'title', 'publisher', 'year'],
  },
  {
    name: 'booklet',
    requiredAttributes: ['key', 'title'],
  },
  {
    name: 'conference',
    requiredAttributes: ['author', 'booktitle', 'title', 'year'],
  },
  {
    name: 'inbook',
    requiredAttributes: ['author', 'title', 'publisher', 'year', 'chapter'],
  },
  {
    name: 'incollection',
    requiredAttributes: ['author', 'title', 'booktitle', 'publisher', 'year'],
  },
  {
    name: 'inproceedings',
    requiredAttributes: ['author', 'title', 'booktitle', 'year'],
  },
  {
    name: 'manual',
    requiredAttributes: ['key', 'title'],
  },
  {
    name: 'mastersthesis',
    requiredAttributes: ['author', 'title', 'school', 'year'],
  },
  {
    name: 'misc',
    requiredAttributes: ['key', 'note'],
  },
  {
    name: 'phdthesis',
    requiredAttributes: ['author', 'title', 'school', 'year'],
  },
  {
    name: 'proceedings',
    requiredAttributes: ['key', 'title', 'year'],
  },
  {
    name: 'techreport',
    requiredAttributes: ['author', 'title', 'institution', 'year'],
  },
  {
    name: 'unpublished',
    requiredAttributes: ['author', 'title', 'note'],
  },
]

const prepareSnippet = (environment: Environment) => {
  return `@${
    environment.name
  }{#{citation-key},${environment.requiredAttributes.map(
    attribute => `
    ${attribute} = #{}`
  )}
}`
}

export function bibtexEntryCompletions(context: CompletionContext) {
  const word = context.matchBefore(/@\w*/)
  if (word?.from === word?.to && !context.explicit) return null
  return {
    from: word?.from ?? context.pos,
    options: [
      ...environments.map(env => ({
        label: `@${env.name}`,
        type: 'snippet',
        apply: snippet(prepareSnippet(env)),
      })),
      {
        label: '@string',
        type: 'snippet',
        apply: snippet('@string{#{string-key} = #{}}'),
      },
    ],
  }
}
