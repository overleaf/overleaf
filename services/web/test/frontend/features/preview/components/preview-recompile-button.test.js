import React from 'react'
import sinon from 'sinon'
import { screen, render, fireEvent } from '@testing-library/react'
import PreviewRecompileButton from '../../../../../frontend/js/features/preview/components/preview-recompile-button'
const { expect } = require('chai')

describe('<PreviewRecompileButton />', function() {
  let onRecompile, onRecompileFromScratch, onStopCompilation

  beforeEach(function() {
    onRecompile = sinon.stub().resolves()
    onRecompileFromScratch = sinon.stub().resolves()
    onStopCompilation = sinon.stub().resolves()
  })

  it('renders all items', function() {
    renderPreviewRecompileButton()

    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems.length).to.equal(9)
    expect(menuItems.map(item => item.textContent)).to.deep.equal([
      'On',
      'Off',
      'Normal',
      'Fast [draft]',
      'Check syntax before compile',
      "Don't check syntax",
      'Run syntax check now',
      'Stop compilation',
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
      it('should call onRecompileFromScratch', async function() {
        renderPreviewRecompileButton()

        const button = screen.getByRole('menuitem', {
          name: 'Recompile from scratch'
        })
        await fireEvent.click(button)
        expect(onRecompileFromScratch).to.have.been.calledOnce
      })
    })
    describe('processing', function() {
      it('shows processing view and disable menuItem when recompiling', function() {
        renderPreviewRecompileButton({ isCompiling: true })

        screen.getByRole('button', { name: 'Compiling…' })
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

  it('should show the button text when prop showText=true', function() {
    const showText = true
    renderPreviewRecompileButton({}, showText)
    expect(screen.getByText('Recompile').getAttribute('style')).to.be.null
  })
  it('should not show the button text when prop showText=false', function() {
    const showText = false
    renderPreviewRecompileButton({}, showText)
    expect(screen.getByText('Recompile').getAttribute('style')).to.equal(
      'position: absolute; right: -100vw;'
    )
  })

  describe('Autocompile feedback', function() {
    it('shows animated visual feedback via CSS class when there are uncompiled changes', function() {
      const { container } = renderPreviewRecompileButton({
        autoCompileHasChanges: true,
        autoCompileHasLintingError: false
      })
      const recompileBtnGroupEl = container.querySelector(
        '.btn-recompile-group'
      )
      expect(
        recompileBtnGroupEl.classList.contains(
          'btn-recompile-group-has-changes'
        )
      ).to.be.true
    })
    it('does not show animated visual feedback via CSS class when there are no uncompiled changes', function() {
      const { container } = renderPreviewRecompileButton({
        autoCompileHasChanges: false,
        autoCompileHasLintingError: false
      })
      const recompileBtnGroupEl = container.querySelector(
        '.btn-recompile-group'
      )
      expect(
        recompileBtnGroupEl.classList.contains(
          'btn-recompile-group-has-changes'
        )
      ).to.be.false
    })
  })

  function renderPreviewRecompileButton(compilerState = {}, showText) {
    if (!compilerState.logEntries) {
      compilerState.logEntries = {}
    }
    if (showText === undefined) showText = true
    return render(
      <PreviewRecompileButton
        compilerState={{
          autoCompileHasChanges: false,
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
        onRecompileFromScratch={onRecompileFromScratch}
        onStopCompilation={onStopCompilation}
        showText={showText}
      />
    )
  }
})
