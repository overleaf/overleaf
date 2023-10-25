const MATHJAX_STUB = `
window.MathJax = { 
  startup: {
    promise: Promise.resolve()
  }, 
  svgStylesheet: () => document.createElement("STYLE"),
  typesetPromise: (elements) => {
    for (const element of elements) {
      // This will keep math delimeters around the text
      element.classList.add('MathJax')
    }
    return Promise.resolve()
  },
  tex2svgPromise: (content) => {
    const text = document.createElement('SPAN')
    text.classList.add('MathJax')
    text.innerText = content
    return Promise.resolve(text)
  },
  getMetricsFor: () => ({}),
  texReset: () => {},
}
`

export const interceptMathJax = () => {
  cy.window().then(win => {
    win.metaAttributesCache.set(
      'ol-mathJax3Path',
      '/js/libs/mathjax3/es5/tex-svg-full.js'
    )
  })
  cy.intercept(
    'GET',
    '/js/libs/mathjax3/es5/tex-svg-full.js*',
    MATHJAX_STUB
  ).as('mathjax-load-request')
}
