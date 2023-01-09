import {
  detachChannelId,
  detachChannel as _detachChannel,
} from '../../../frontend/js/shared/context/detach-context'

// for tests, assert that detachChannel is defined, as BroadcastChannel is available
export const detachChannel = _detachChannel!

// simulate messages from another tab by posting them to this channel
export const testDetachChannel = new BroadcastChannel(detachChannelId)
