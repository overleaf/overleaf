import type { Nullable } from '../../../../../types/utils'

export function calculateWatchingTimeInSecond(
  startTimeWatchedFirstVideo: number,
  startTimeWatchedSecondVideo: Nullable<number>
) {
  let firstVideoWatchingTimeInSecond = 0
  let secondVideoWatchingTimeInSecond = 0
  if (startTimeWatchedSecondVideo === null) {
    firstVideoWatchingTimeInSecond = Math.floor(
      (Date.now() - startTimeWatchedFirstVideo) / 1000
    )
  } else {
    firstVideoWatchingTimeInSecond = Math.floor(
      (startTimeWatchedSecondVideo - startTimeWatchedFirstVideo) / 1000
    )
    secondVideoWatchingTimeInSecond = Math.floor(
      (Date.now() - startTimeWatchedSecondVideo) / 1000
    )
  }

  return { firstVideoWatchingTimeInSecond, secondVideoWatchingTimeInSecond }
}
