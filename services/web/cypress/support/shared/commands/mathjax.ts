const MATHJAX_STUB = `
window.MathJax = { 
  startup: {
    promise: Promise.resolve()
  }, 
  svgStylesheet: () => document.createElement("STYLE") 
}
`

export const interceptMathJax = () => {
  cy.window().then(win => {
    win.metaAttributesCache.set(
      'ol-mathJax3Path',
      'https://unpkg.com/mathjax@3.2.2/es5/tex-svg-full.js'
    )
  })
  cy.intercept('GET', '/js/libs/mathjax3/es5/tex-svg-full.js*', MATHJAX_STUB)
  cy.intercept(
    'GET',
    'https://unpkg.com/mathjax@3.2.2/es5/tex-svg-full.js',
    MATHJAX_STUB
  )
}
