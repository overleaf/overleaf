import React from 'react'
import sinon from 'sinon'
import { screen, render, fireEvent } from '@testing-library/react'
import PreviewRecompileButton from '../../../../../frontend/js/features/preview/components/preview-recompile-button'
const { expect } = require('chai')

describe('<PreviewRecompileButton />', function() {
  let onRecompile, onClearCache

  beforeEach(function() {
    onRecompile = sinon.stub().resolves()
    onClearCache = sinon.stub().resolves()
  })

  it('renders all items', function() {
    renderPreviewRecompileButton()

    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems.length).to.equal(8)
    expect(menuItems.map(item => item.textContent)).to.deep.equal([
      'On',
      'Off',
      'Normal',
      'Fast [draft]',
      'Check syntax before compile',
      "Don't check syntax",
      'Run syntax check now',
      'Recompile from scratch'
    ])

    const menuHeadingItems = screen.getAllByRole('heading')
    expect(menuHeadingItems.length).to.equal(3)
    expect(menuHeadingItems.map(item => item.textContent)).to.deep.equal([
      'Auto Compile',
      'Compile Mode',
      'Syntax Checks'
    ])
  })

  describe('Recompile from scratch', function() {
    describe('click', function() {
      it('should call onClearCache and onRecompile', async function() {
        renderPreviewRecompileButton()

        const button = screen.getByRole('menuitem', {
          name: 'Recompile from scratch'
        })
        await fireEvent.click(button)
        expect(onClearCache).to.have.been.calledOnce
        expect(onRecompile).to.have.been.calledOnce
      })
    })
    describe('processing', function() {
      it('shows processing view and disable menuItem when clearing cache', function() {
        renderPreviewRecompileButton({ isClearingCache: true })

        screen.getByRole('button', { name: 'Compiling …' })
        expect(
          screen
            .getByRole('menuitem', {
              name: 'Recompile from scratch'
            })
            .getAttribute('aria-disabled')
        ).to.equal('true')
        expect(
          screen
            .getByRole('menuitem', {
              name: 'Recompile from scratch'
            })
            .closest('li')
            .getAttribute('class')
        ).to.equal('disabled')
      })

      it('shows processing view and disable menuItem when recompiling', function() {
        renderPreviewRecompileButton({ isCompiling: true })

        screen.getByRole('button', { name: 'Compiling …' })
        expect(
          screen
            .getByRole('menuitem', {
              name: 'Recompile from scratch'
            })
            .getAttribute('aria-disabled')
        ).to.equal('true')
        expect(
          screen
            .getByRole('menuitem', {
              name: 'Recompile from scratch'
            })
            .closest('li')
            .getAttribute('class')
        ).to.equal('disabled')
      })
    })
  })

  function renderPreviewRecompileButton(compilerState = {}) {
    if (!compilerState.logEntries) {
      compilerState.logEntries = {}
    }
    render(
      <PreviewRecompileButton
        compilerState={{
          isAutoCompileOn: true,
          isClearingCache: false,
          isCompiling: false,
          isDraftModeOn: false,
          isSyntaxCheckOn: false,
          ...compilerState
        }}
        onRecompile={onRecompile}
        onRunSyntaxCheckNow={() => {}}
        onSetAutoCompile={() => {}}
        onSetDraftMode={() => {}}
        onSetSyntaxCheck={() => {}}
        onClearCache={onClearCache}
      />
    )
  }
})
