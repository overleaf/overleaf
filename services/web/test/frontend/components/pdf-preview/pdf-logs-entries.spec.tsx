import { mount } from '@cypress/react'
import sysendTestHelper from '../../helpers/sysend'
import { EditorProviders } from '../../helpers/editor-providers'
import PdfLogsEntries from '../../../../frontend/js/features/pdf-preview/components/pdf-logs-entries'
window.metaAttributesCache = new Map([['ol-debugPdfDetach', true]])

describe('<PdfLogsEntries/>', function () {
  const fakeEntity = { type: 'doc' }

  const logEntries = [
    {
      file: 'main.tex',
      line: 9,
      column: 8,
      level: 'error',
      message: 'LaTeX Error',
      content: 'See the LaTeX manual',
      raw: '',
      ruleId: 'hint_misplaced_alignment_tab_character',
      key: '',
    },
  ]

  let props

  beforeEach(function () {
    props = {
      fileTreeManager: {
        findEntityByPath: cy.stub().as('findEntityByPath').returns(fakeEntity),
      },
      editorManager: {
        openDoc: cy.stub().as('openDoc'),
      },
    }

    cy.interceptCompile()
    cy.interceptEvents()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    sysendTestHelper.resetHistory()
  })

  it('displays human readable hint', function () {
    mount(
      <EditorProviders {...props}>
        <PdfLogsEntries entries={logEntries} />
      </EditorProviders>
    )

    cy.contains('You have placed an alignment tab character')
  })

  it('opens doc on click', function () {
    mount(
      <EditorProviders {...props}>
        <PdfLogsEntries entries={logEntries} />
      </EditorProviders>
    )

    cy.findByRole('button', {
      name: 'Navigate to log position in source code: main.tex, 9',
    })
      .click()
      .then(() => {
        expect(props.fileTreeManager.findEntityByPath).to.be.calledOnce
        expect(props.editorManager.openDoc).to.be.calledOnce
        expect(props.editorManager.openDoc).to.be.calledWith(fakeEntity, {
          gotoLine: 9,
          gotoColumn: 8,
        })
      })
  })

  it('opens doc via detached action', function () {
    cy.window().then(win => {
      win.metaAttributesCache = new Map([['ol-detachRole', 'detacher']])
    })

    mount(
      <EditorProviders {...props}>
        <PdfLogsEntries entries={logEntries} />
      </EditorProviders>
    ).then(() => {
      sysendTestHelper.receiveMessage({
        role: 'detached',
        event: 'action-sync-to-entry',
        data: {
          args: [
            {
              file: 'main.tex',
              line: 7,
              column: 6,
            },
          ],
        },
      })

      expect(props.fileTreeManager.findEntityByPath).to.be.calledOnce
      expect(props.editorManager.openDoc).to.be.calledOnce
      expect(props.editorManager.openDoc).to.be.calledWith(fakeEntity, {
        gotoLine: 7,
        gotoColumn: 6,
      })
    })
  })

  it('sends open doc clicks via detached action', function () {
    cy.window().then(win => {
      win.metaAttributesCache = new Map([['ol-detachRole', 'detached']])
    })

    mount(
      <EditorProviders {...props}>
        <PdfLogsEntries entries={logEntries} />
      </EditorProviders>
    )

    cy.findByRole('button', {
      name: 'Navigate to log position in source code: main.tex, 9',
    })
      .click()
      .then(() => {
        expect(props.fileTreeManager.findEntityByPath).not.to.be.called
        expect(props.editorManager.openDoc).not.to.be.called

        expect(sysendTestHelper.getLastBroacastMessage()).to.deep.equal({
          role: 'detached',
          event: 'action-sync-to-entry',
          data: {
            args: [
              {
                file: 'main.tex',
                line: 9,
                column: 8,
              },
            ],
          },
        })
      })
  })
})
