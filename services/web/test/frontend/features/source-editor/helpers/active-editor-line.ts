export const activeEditorLine = () => {
  // wait for the selection to be in the editor content DOM
  cy.window().then(win => {
    cy.get('.cm-content').should($el => {
      const contentNode = $el.get(0)
      const range = win.getSelection()?.getRangeAt(0)
      expect(range?.intersectsNode(contentNode)).to.be.true
    })
  })

  // find the closest line block ancestor of the selection
  return cy.window().then(win => {
    const activeNode = win.getSelection()?.focusNode

    if (!activeNode) {
      return cy.wrap(null)
    }

    // use the parent element if this is a node, e.g. text
    const activeElement =
      'closest' in activeNode ? activeNode : activeNode.parentElement

    return cy.wrap(activeElement?.closest('.cm-line'))
  })
}
