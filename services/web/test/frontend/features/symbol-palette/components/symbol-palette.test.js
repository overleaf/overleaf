import { expect } from 'chai'
import sinon from 'sinon'
import React from 'react'
import { screen, render, fireEvent, waitFor } from '@testing-library/react'
import SymbolPalette from '../../../../../frontend/js/features/symbol-palette/components/symbol-palette'

describe('symbol palette', function () {
  let clock

  before(function () {
    clock = sinon.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
  })

  after(function () {
    clock.runAll()
    clock.restore()
  })

  it('handles keyboard interaction', async function () {
    this.timeout(10000)

    const handleSelect = sinon.stub()

    const { container } = render(
      <SymbolPalette show handleSelect={handleSelect} />
    )

    // check the number of tabs
    const tabs = await screen.findAllByRole('tab')
    expect(tabs).to.have.length(5)

    let selectedTab
    let symbols

    // the first tab should be selected
    selectedTab = await screen.getByRole('tab', { selected: true })
    expect(selectedTab.textContent).to.equal('Greek')
    symbols = await screen.findAllByRole('option')
    expect(symbols).to.have.length(39)

    // click to select the third tab
    tabs[2].click()
    selectedTab = await screen.getByRole('tab', { selected: true })
    expect(selectedTab.textContent).to.equal('Operators')
    symbols = await screen.findAllByRole('option')
    expect(symbols).to.have.length(20)

    // press the left arrow to select the second tab
    fireEvent.keyDown(selectedTab, { key: 'ArrowLeft' })
    selectedTab = await screen.getByRole('tab', { selected: true })
    expect(selectedTab.textContent).to.equal('Arrows')
    symbols = await screen.findAllByRole('option')
    expect(symbols).to.have.length(16)

    // select the search input
    const input = await screen.getByRole('searchbox')
    input.click()

    // type in the search input
    fireEvent.change(input, { target: { value: 'pi' } })

    // make sure all scheduled microtasks have executed
    clock.runAll()

    // wait for the symbols to be filtered
    await waitFor(async () => {
      symbols = await screen.findAllByRole('option')
      expect(symbols).to.have.length(2)
    })

    // press Tab to select the symbols
    fireEvent.keyDown(container, { key: 'Tab' })

    // get the selected symbol
    let selectedSymbol

    selectedSymbol = await screen.getByRole('option', { selected: true })
    expect(selectedSymbol.textContent).to.equal('𝜋')

    // move to the next symbol
    fireEvent.keyDown(selectedSymbol, { key: 'ArrowRight' })

    // wait for the symbol to be selected
    selectedSymbol = await screen.getByRole('option', { selected: true })
    expect(selectedSymbol.textContent).to.equal('Π')

    // click on the selected symbol
    selectedSymbol.click()

    expect(handleSelect).to.have.been.calledWith({
      aliases: ['Π'],
      category: 'Greek',
      character: 'Π',
      codepoint: 'U+003A0',
      command: '\\Pi',
      description: 'Uppercase Greek letter Pi',
      notes: 'Use \\prod for the product.',
    })
  })
})
