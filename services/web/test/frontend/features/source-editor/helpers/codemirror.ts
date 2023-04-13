/* eslint-disable no-dupe-class-members */
import { LanguageSupport } from '@codemirror/language'
import { EditorSelection, Line, SelectionRange } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { Assertion } from 'chai'
import { LaTeXLanguage } from '../../../../../frontend/js/features/source-editor/languages/latex/latex-language'

export class CodemirrorTestSession {
  public view: EditorView

  constructor(content: string[] | string) {
    this.view = createView(content)
  }

  insert(content: string): void {
    this.view.dispatch(
      this.view.state.changeByRange(range => {
        const changeDescription = [
          {
            from: range.from,
            to: range.to,
            insert: content,
          },
        ]

        const changes = this.view.state.changes(changeDescription)

        return {
          range: EditorSelection.cursor(range.head).map(changes),
          changes,
        }
      })
    )
  }

  insertAt(position: number, content: string) {
    const changes = [{ from: position, insert: content }]
    this.view.dispatch({
      changes,
      selection: this.view.state.selection.map(
        this.view.state.changes(changes),
        1
      ),
    })
  }

  insertAtLine(line: number, offset: number, content: string): void
  insertAtLine(line: number, content: string): void
  insertAtLine(
    lineNumber: number,
    offsetOrContent: string | number,
    content?: string
  ) {
    const line = this.view.state.doc.line(lineNumber)
    if (typeof offsetOrContent === 'string' && typeof content === 'string') {
      throw new Error(
        'If a third argument is provided, the second must be an integer'
      )
    }
    // Insert at end of line
    if (typeof offsetOrContent === 'string') {
      content = offsetOrContent
      offsetOrContent = line.to
    }

    if (typeof content !== 'string') {
      throw new Error('content must be provided to insertAtLine')
    }

    if (offsetOrContent < line.from || offsetOrContent > line.to) {
      throw new Error('Offset is outside the range of the line')
    }
    this.insertAt(line.from + offsetOrContent, content)
  }

  delete(position: number, length: number) {
    this.view.dispatch({
      changes: [{ from: position - length, to: position }],
    })
  }

  applyCommand(command: (view: EditorView) => any) {
    return command(this.view)
  }

  setCursor(position: number): void
  setCursor(line: number, offset: number): void
  setCursor(positionOrLine: number, offset?: number) {
    if (offset !== undefined) {
      const line = this.view.state.doc.line(positionOrLine)
      positionOrLine = line.from + offset
    }
    this.view.dispatch({
      selection: EditorSelection.cursor(positionOrLine),
    })
  }

  setSelection(selection: EditorSelection) {
    this.view.dispatch({
      selection,
    })
  }
}

const latex = new LanguageSupport(LaTeXLanguage)
function createView(content: string[] | string): EditorView {
  if (Array.isArray(content)) {
    content = content.join('\n')
  }
  return new EditorView({
    doc: stripSelectionMarkers(content),
    selection: createSelections(content) ?? EditorSelection.cursor(0),
    extensions: [latex],
  })
}

function stripSelectionMarkers(content: string) {
  return content.replaceAll(/[<|>]/g, '')
}

function hasSelectionMarkers(content: string) {
  return !!content.match(/[<|>]/g)
}

function createSelections(content: string, offset = 0) {
  const selections = []
  let index = 0
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '|') {
      selections.push(EditorSelection.cursor(index + offset))
    }
    if (content[i] === '<') {
      // find end
      const startOfRange = index
      let foundEnd = false
      for (++i; i < content.length; ++i) {
        if (content[i] === '|') {
          throw new Error(
            "Invalid cursor indicator '|' within a range started with '<'"
          )
        }
        if (content[i] === '<') {
          throw new Error(
            "Invalid start range indicator '<' inside another range"
          )
        }
        if (content[i] === '>') {
          foundEnd = true
          selections.push(
            EditorSelection.range(startOfRange + offset, index + offset)
          )
          break
        }
        index++
      }
      if (!foundEnd) {
        throw new Error("Missing end range indicator '>'")
      }
    }
    index++
  }
  if (selections.length) {
    return EditorSelection.create(selections)
  }
  return null
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace Chai {
    interface Assertion {
      line(lineNumber: number): Assertion
    }
  }
}

export function viewHelpers(chai: Chai.ChaiStatic, utils: Chai.ChaiUtils) {
  utils.addMethod(
    chai.Assertion.prototype,
    'line',
    function getLine(this: Chai.Assertion, line: number) {
      const object = utils.flag(this, 'object')
      new Assertion(object).to.be.instanceOf(CodemirrorTestSession)
      const testSession = object as CodemirrorTestSession
      const lineInEditor = testSession.view.state.doc.line(line)
      utils.flag(this, 'object', lineInEditor.text)
      utils.flag(this, 'cmSession', testSession)
      utils.flag(this, 'line', lineInEditor)
    }
  )
  utils.overwriteMethod(chai.Assertion.prototype, 'equal', (_super: any) => {
    return function newEqual(
      this: Chai.Assertion,
      value: string,
      requireSelections?: boolean
    ) {
      const session = utils.flag(this, 'cmSession') as
        | CodemirrorTestSession
        | undefined
      utils.flag(this, 'cmSession', null)
      const line = utils.flag(this, 'line') as Line | undefined
      utils.flag(this, 'line', null)

      if (!session || !line) {
        // eslint-disable-next-line prefer-rest-params
        return _super.apply(this, arguments)
      }

      const lineContent = stripSelectionMarkers(value)

      if (requireSelections === undefined) {
        requireSelections = hasSelectionMarkers(value)
      }

      // We can now check selections as well
      const selections = createSelections(value, line.from)
      const contentAssertion = new Assertion(line.text)
      utils.transferFlags(this, contentAssertion)
      contentAssertion.to.equal(lineContent)

      if (selections) {
        const selectionAssertion = new Assertion(
          session.view.state.selection.ranges
        )
        utils.transferFlags(this, selectionAssertion, false)
        for (const rangeToMatch of selections.ranges) {
          selectionAssertion.satisfies(
            (ranges: SelectionRange[]) =>
              ranges.some(
                possibleMatch =>
                  possibleMatch.eq(rangeToMatch) ||
                  // Allow reverse selections as well, as we don't syntactically
                  // distinguish them
                  EditorSelection.range(
                    possibleMatch.to,
                    possibleMatch.from
                  ).eq(rangeToMatch)
              ),
            `Selections [${session.view.state.selection.ranges
              .map(range => `{ from: ${range.from}, to: ${range.to}}`)
              .join(', ')}] did not include selection {from: ${
              rangeToMatch.from
            }, to: ${rangeToMatch.to}}`
          )
        }
      }
    }
  })
}
