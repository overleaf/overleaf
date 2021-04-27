import sinon from 'sinon'

export function stubMathJax() {
  window.MathJax = {
    Hub: {
      Queue: sinon.stub(),
      config: { tex2jax: { inlineMath: [['$', '$']] } },
    },
  }
}

export function tearDownMathJaxStubs() {
  delete window.MathJax
}
