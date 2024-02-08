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
  // NOTE: this is just a URL to be intercepted with the stub, not the real (versioned) MathJax URL
  const url = '/js/libs/mathjax/es5/tex-svg-full.js'
  cy.window().then(win => {
    win.metaAttributesCache.set('ol-mathJaxPath', url)
  })
  cy.intercept('GET', url, MATHJAX_STUB).as('mathjax-load-request')
}
