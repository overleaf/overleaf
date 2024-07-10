import { syntaxTree } from '@codemirror/language'
import { Diagnostic, LintSource } from '@codemirror/lint'
import {
  Declaration,
  EntryName,
  EntryTypeName,
  FieldName,
  Other,
} from '../../lezer-bibtex/bibtex.terms.mjs'
import { SyntaxNodeRef } from '@lezer/common'
import { EditorState } from '@codemirror/state'
import { createLinter } from '../../extensions/linting'

type BibEntryValidationRule = {
  requiredAttributes: (string | string[])[]
  biblatex?: Record<string, string>
}

export const bibtexLinter = () => createLinter(bibtexLintSource, { delay: 100 })

export const bibtexLintSource: LintSource = view => {
  const tree = syntaxTree(view.state)

  const diagnostics: Diagnostic[] = []

  // Linting be temporarily disabled by a %%begin novalidate directive. It can
  // be re-enabled by a %%end novalidate directive
  let lintingCurrentlyDisabled = false

  // Linting is completely disabled by a %%novalidate so will return no linter
  // errors
  let fileLintingDisabled = false

  tree.iterate({
    enter(node) {
      if (fileLintingDisabled) {
        return false
      }
      if (node.type.is(Other)) {
        // Content between declaration. Can be linter directive
        const content = view.state.sliceDoc(node.from, node.to).trim()
        if (content === '%%novalidate') {
          fileLintingDisabled = true
        } else if (content === '%%begin novalidate') {
          lintingCurrentlyDisabled = true
        } else if (content === '%%end novalidate') {
          lintingCurrentlyDisabled = false
        }
      }
      if (lintingCurrentlyDisabled) {
        return false
      }
      if (node.type.is(Declaration)) {
        diagnostics.push(...checkRequiredFields(node, view.state))
        return false
      }
    },
  })

  if (fileLintingDisabled) {
    return []
  } else {
    return diagnostics
  }
}

const bibEntryValidationRules = new Map<string, BibEntryValidationRule>([
  [
    'article',
    {
      requiredAttributes: ['author', 'title', 'journal', 'year'],
      biblatex: {
        journal: 'journaltitle',
        year: 'date',
      },
    },
  ],
  [
    'book',
    {
      requiredAttributes: [['author', 'editor'], 'title', 'publisher', 'year'],
      biblatex: {
        year: 'date',
      },
    },
  ],
  [
    'booklet',
    {
      requiredAttributes: [['author', 'key'], 'title'],
    },
  ],
  [
    'conference',
    {
      requiredAttributes: ['author', 'title', 'year', 'booktitle'],
      biblatex: {
        year: 'date',
      },
    },
  ],
  [
    'inbook',
    {
      requiredAttributes: ['author', 'title', 'publisher', 'year'],
      biblatex: {
        year: 'date',
      },
    },
  ],
  [
    'incollection',
    {
      requiredAttributes: ['author', 'title', 'booktitle', 'publisher', 'year'],
      biblatex: {
        year: 'date',
      },
    },
  ],
  [
    'inproceedings',
    {
      requiredAttributes: ['author', 'title', 'booktitle', 'year'],
      biblatex: {
        year: 'date',
      },
    },
  ],
  [
    'manual',
    {
      requiredAttributes: [['author', 'key', 'organization'], 'title'],
    },
  ],
  [
    'mastersthesis',
    {
      requiredAttributes: ['author', 'title', 'school', 'year'],
      biblatex: {
        year: 'date',
      },
    },
  ],
  [
    'misc',
    {
      requiredAttributes: [['author', 'key']],
    },
  ],
  [
    'phdthesis',
    {
      requiredAttributes: ['author', 'title', 'school', 'year'],
      biblatex: {
        year: 'date',
      },
    },
  ],
  [
    'proceedings',
    {
      requiredAttributes: [['editor', 'key', 'organization'], 'title', 'year'],
      biblatex: {
        year: 'date',
      },
    },
  ],
  [
    'techreport',
    {
      requiredAttributes: ['author', 'title', 'institution', 'year'],
      biblatex: {
        year: 'date',
      },
    },
  ],
  [
    'unpublished',
    {
      requiredAttributes: ['author', 'title', 'note'],
    },
  ],
])

const checkRequiredFields = (
  nodeRef: SyntaxNodeRef,
  state: EditorState
): Diagnostic[] => {
  // We just return no errors if we don't find the info we're looking for in the
  // syntax tree
  const node = nodeRef.node

  const entryNameNode = node.getChild(EntryName)
  if (!entryNameNode) {
    return []
  }

  const entryTypeNameNode = entryNameNode.getChild(EntryTypeName)
  if (!entryTypeNameNode) {
    return []
  }
  const entryTypeName = state
    .sliceDoc(entryTypeNameNode.from, entryTypeNameNode.to)
    .toLowerCase()
  const environment = bibEntryValidationRules.get(entryTypeName)
  if (!environment) {
    return []
  }
  const requiredFields = environment.requiredAttributes

  const actualFieldNodes = node.getChildren('Field')
  const actualFieldNames = new Set(
    actualFieldNodes
      .map(fieldNode => fieldNode.getChild(FieldName))
      .map(fieldNode =>
        fieldNode ? state.sliceDoc(fieldNode.from, fieldNode.to) : undefined
      )
      .filter(Boolean)
      .map(name => name?.toLowerCase())
  )

  if (actualFieldNames.has('crossref')) {
    // We don't want to deal with crossrefs (key inheritance from other entries)
    return []
  }

  const entryHasField = (fieldName: string): boolean => {
    if (actualFieldNames.has(fieldName)) {
      return true
    }
    if (environment.biblatex && environment.biblatex[fieldName]) {
      return actualFieldNames.has(environment.biblatex[fieldName])
    }
    return false
  }

  const missingFields = requiredFields.filter(field => {
    if (Array.isArray(field)) {
      return !field.some(f => entryHasField(f))
    } else {
      return !entryHasField(field)
    }
  })

  if (missingFields.length === 0) {
    // All is good
    return []
  }

  return [
    {
      from: entryNameNode.from,
      to: entryNameNode.to,
      message: createErrorMessage(missingFields, entryTypeName, state),
      severity: 'warning',
    },
  ]
}

function createErrorMessage(
  missingFields: (string[] | string)[],
  entryTypeName: string,
  state: EditorState
) {
  const translation =
    missingFields.length === 1
      ? state.phrase('missing_field_for_entry')
      : state.phrase('missing_fields_for_entry')
  const or = state.phrase('or')
  const errorLines = missingFields
    .map(fieldOptions => {
      const options = Array.isArray(fieldOptions)
        ? fieldOptions
        : [fieldOptions]
      return createOrList(options, or)
    })
    .map(field => `  •  ${field}`)
    .join('\n')
  return `${translation} ${entryTypeName}:\n${errorLines}`
}

function createOrList(fields: string[], orPhrase: string) {
  if (fields.length === 0) {
    return ''
  }
  if (fields.length === 1) {
    return fields[0]
  }
  return (
    fields.slice(0, -1).join(', ') + ` ${orPhrase} ` + fields[fields.length - 1]
  )
}
