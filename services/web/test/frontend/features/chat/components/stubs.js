import sinon from 'sinon'
import { resetChatStore } from '../../../../../frontend/js/features/chat/store/chat-store-effect'

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
  window._ide = { socket: { on: sinon.stub(), off: sinon.stub() } }
  window.dispatchEvent = sinon.stub()
  window.user = user
  resetChatStore()
}

export function tearDownChatStore() {
  delete window._ide
  delete window.dispatchEvent
  delete window.user
}
