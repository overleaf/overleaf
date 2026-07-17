import { render, screen } from '@testing-library/react'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { CompileTimeWarningUpgradePromptInner } from '@/features/pdf-preview/components/compile-time-warning-upgrade-prompt-inner'

function renderPrompt() {
  return render(
    <SplitTestProvider>
      <CompileTimeWarningUpgradePromptInner
        handleDismissWarning={() => {}}
        segmentation={{}}
      />
    </SplitTestProvider>
  )
}

describe('<CompileTimeWarningUpgradePromptInner/>', function () {
  afterEach(function () {
    window.metaAttributesCache.delete('ol-splitTestVariants')
  })

  it('shows the "Start free trial" CTA by default', function () {
    window.metaAttributesCache.set('ol-splitTestVariants', {})
    renderPrompt()
    screen.getByRole('button', { name: 'Start free trial' })
  })

  it('shows the "Subscribe now" CTA when paywall-cta-trial-ineligible is enabled', function () {
    window.metaAttributesCache.set('ol-splitTestVariants', {
      'paywall-cta-trial-ineligible': 'enabled',
    })
    renderPrompt()
    screen.getByRole('button', { name: 'Subscribe now' })
  })
})
