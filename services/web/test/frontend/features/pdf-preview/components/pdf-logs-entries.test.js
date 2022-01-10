import PdfLogsEntries from '../../../../../frontend/js/features/pdf-preview/components/pdf-logs-entries'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import { screen, fireEvent } from '@testing-library/react'
import sysendTestHelper from '../../../helpers/sysend'
import { expect } from 'chai'
import sinon from 'sinon'

describe('<PdfLogsEntries/>', function () {
  const fileTreeManager = {}
  const editorManager = {}
  const logEntries = [
    {
      file: 'main.tex',
      line: 9,
      column: 8,
      level: 'error',
      message: 'LaTeX Error',
      content: 'See the LaTeX manual',
      raw: '',
      ruleId: 'latex_error',
      humanReadableHint: '',
      humanReadableHintComponent: <></>,
      key: '',
    },
  ]
  const fakeEntity = { type: 'doc' }

  beforeEach(function () {
    fileTreeManager.findEntityByPath = sinon.stub().returns(fakeEntity)
    editorManager.openDoc = sinon.stub()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    sysendTestHelper.resetHistory()
    fileTreeManager.findEntityByPath.resetHistory()
  })

  it('opens doc on click', async function () {
    renderWithEditorContext(<PdfLogsEntries entries={logEntries} />, {
      fileTreeManager,
      editorManager,
    })

    const button = await screen.getByRole('button', {
      name: 'Navigate to log position in source code: main.tex, 9',
    })
    fireEvent.click(button)
    sinon.assert.calledOnce(fileTreeManager.findEntityByPath)
    sinon.assert.calledOnce(editorManager.openDoc)
    sinon.assert.calledWith(editorManager.openDoc, fakeEntity, {
      gotoLine: 9,
      gotoColumn: 8,
    })
  })

  it('opens doc via detached action', async function () {
    window.metaAttributesCache.set('ol-detachRole', 'detacher')

    renderWithEditorContext(<PdfLogsEntries entries={logEntries} />, {
      fileTreeManager,
      editorManager,
    })

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

    sinon.assert.calledOnce(fileTreeManager.findEntityByPath)
    sinon.assert.calledOnce(editorManager.openDoc)
    sinon.assert.calledWith(editorManager.openDoc, fakeEntity, {
      gotoLine: 7,
      gotoColumn: 6,
    })
  })

  it('sends open doc clicks via detached action', async function () {
    window.metaAttributesCache.set('ol-detachRole', 'detached')
    renderWithEditorContext(<PdfLogsEntries entries={logEntries} />, {
      fileTreeManager,
      editorManager,
    })

    const button = await screen.getByRole('button', {
      name: 'Navigate to log position in source code: main.tex, 9',
    })
    fireEvent.click(button)
    sinon.assert.notCalled(fileTreeManager.findEntityByPath)
    sinon.assert.notCalled(editorManager.openDoc)
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
