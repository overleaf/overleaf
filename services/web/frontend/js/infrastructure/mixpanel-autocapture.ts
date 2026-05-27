import { createTrackingLoader } from '@/infrastructure/tracking-loader'

function initializeMixpanelAutocapture() {
  if (window.olLoadMixpanelAutocapture) {
    window.olLoadMixpanelAutocapture()
  }
}

createTrackingLoader(
  () => initializeMixpanelAutocapture(),
  'MixpanelAutocapture'
)
