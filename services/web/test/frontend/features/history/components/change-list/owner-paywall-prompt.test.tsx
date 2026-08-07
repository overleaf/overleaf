import { render, screen, fireEvent } from '@testing-library/react'
import sinon from 'sinon'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { OwnerPaywallPrompt } from '@/features/history/components/change-list/owner-paywall-prompt'

function renderPrompt() {
  return render(
    <SplitTestProvider>
      <OwnerPaywallPrompt />
    </SplitTestProvider>
  )
}

describe('<OwnerPaywallPrompt/>', function () {
  let openStub: sinon.SinonStub

  beforeEach(function () {
    // StartFreeTrialButton opens the plans page in a new tab on click
    openStub = sinon.stub(window, 'open')
  })

  afterEach(function () {
    openStub.restore()
    window.metaAttributesCache.delete('ol-splitTestVariants')
  })

  it('shows the "Start free trial" CTA and free-trial refresh message', function () {
    window.metaAttributesCache.set('ol-splitTestVariants', {})
    renderPrompt()
    fireEvent.click(screen.getByRole('button', { name: 'Start free trial' }))
    screen.getByText('Please refresh this page after starting your free trial.')
  })
})
