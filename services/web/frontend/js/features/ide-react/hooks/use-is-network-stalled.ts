import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useUnsavedDocsContext } from '@/features/ide-react/context/unsaved-docs-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useConnectionContext } from '../context/connection-context'

export function useIsNetworkStalledState(): boolean {
  const { isSavingStalled } = useUnsavedDocsContext()
  const { outOfSync } = useIdeReactContext()
  const { isConnected, connectionState } = useConnectionContext()
  const websocketDisconnected =
    !isConnected || connectionState.reconnectAt !== null
  return isSavingStalled || outOfSync || websocketDisconnected
}

export default function useIsNetworkStalled(): boolean {
  const enabled = useFeatureFlag('intermittent-connection-improvements')
  const stalled = useIsNetworkStalledState()
  return enabled && stalled
}
