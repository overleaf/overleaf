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
  // @ts-expect-error - this is a stub that we're setting ourselves per test
  delete window.MathJax
}
