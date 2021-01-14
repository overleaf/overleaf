import sinon from 'sinon'

export function stubUIConfig() {
  window.uiConfig = {
    chatMessageBorderSaturation: '85%',
    chatMessageBorderLightness: '40%',
    chatMessageBgSaturation: '85%',
    chatMessageBgLightness: '40%'
  }
}

export function tearDownUIConfigStubs() {
  delete window.uiConfig
}

export function stubMathJax() {
  window.MathJax = {
    Hub: {
      Queue: sinon.stub(),
      config: { tex2jax: { inlineMath: [['$', '$']] } }
    }
  }
}

export function tearDownMathJaxStubs() {
  delete window.MathJax
}

export function stubChatStore({ user }) {
  window.user = user
}

export function tearDownChatStore() {
  delete window.user
}
