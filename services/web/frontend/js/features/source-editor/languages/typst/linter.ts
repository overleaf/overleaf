import { syntaxTree } from '@codemirror/language'
import { Diagnostic, LintSource } from '@codemirror/lint'
import { TypstParser } from "codemirror-lang-typst"
import { SyntaxNodeRef } from '@lezer/common'
import { EditorState } from '@codemirror/state'
import { createLinter } from '../../extensions/linting'

type BibEntryValidationRule = {
  requiredAttributes: (string | string[])[]
  biblatex?: Record<string, string>
}

export const typstLinter = () => createLinter(typstLintSource, { delay: 100 })

export const typstLintSource: LintSource = view => {
  const tree = syntaxTree(view.state)

  const diagnostics: Diagnostic[] = []

  tree.iterate({
    enter(node) {
      if (node.type.name == "Error") {
        let { from, to } = node;
        // Content between declaration. Can be linter directive
        diagnostics.push({
          from, to, severity: "error", message: (node as any)._tree._tree.error.message
        })
      }
    },
  })

  return diagnostics
}
