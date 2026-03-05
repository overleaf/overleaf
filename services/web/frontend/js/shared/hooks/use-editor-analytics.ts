import {
  Segmentation,
  sendMB,
  sendMBOnce,
  sendMBSampled,
} from '@/infrastructure/event-tracking'
import { useCallback } from 'react'

export function populateEditorRedesignSegmentation<
  SegmentationType extends Segmentation,
>(
  segmentation: SegmentationType | undefined = {} as SegmentationType
): SegmentationType & { 'editor-redesign'?: 'enabled' } {
  return { ...segmentation, 'editor-redesign': 'enabled' }
}

export const useEditorAnalytics = () => {
  const populateSegmentation = useCallback(
    (segmentation: Segmentation | undefined = {}): Segmentation => {
      return populateEditorRedesignSegmentation(segmentation)
    },
    []
  )

  const sendEvent: typeof sendMB = useCallback(
    (key, segmentation) => {
      sendMB(key, populateSegmentation(segmentation))
    },
    [populateSegmentation]
  )

  const sendEventOnce: typeof sendMBOnce = useCallback(
    (key, segmentation) => {
      sendMBOnce(key, populateSegmentation(segmentation))
    },
    [populateSegmentation]
  )

  const sendEventSampled: typeof sendMBSampled = useCallback(
    (key, segmentation, rate) => {
      sendMBSampled(key, populateSegmentation(segmentation), rate)
    },
    [populateSegmentation]
  )

  return { sendEvent, sendEventOnce, sendEventSampled }
}
