import '../../marketing'
import '@/infrastructure/hotjar'
import getMeta from '@/utils/meta'

interface FrameOptions {
  buildTime: number
  holdTime: number
  breakTime: number
}

interface Frame {
  before: string
  time: number
}

function homepageAnimation(homepageAnimationEl: HTMLElement, words: string[]) {
  function createFrames(
    word: string,
    { buildTime, holdTime, breakTime }: FrameOptions
  ): Frame[] {
    const frames: Frame[] = []
    let current = ''

    // Build up the word
    for (const char of word) {
      current += char
      frames.push({ before: current, time: buildTime })
    }

    // Hold the complete word
    frames.push({ before: current, time: holdTime })

    // Break down the word
    for (let i = word.length - 1; i > 0; i--) {
      current = word.substring(0, i)
      frames.push({ before: current, time: breakTime })
    }

    // Add the final frame with an empty string
    frames.push({ before: '', time: breakTime })

    return frames
  }

  const opts: FrameOptions = {
    buildTime: 100,
    holdTime: 1000,
    breakTime: 100,
  }

  const frames: Frame[] = [
    // 1.5s pause before starting
    { before: '', time: 1500 },
    ...words.flatMap((word, index) =>
      createFrames(
        word,
        // 5s pause on the final word
        index === words.length - 1 ? { ...opts, holdTime: 5000 } : opts
      )
    ),
  ]

  let index = 0
  function nextFrame(): void {
    const frame = frames[index]
    index = (index + 1) % frames.length

    homepageAnimationEl.textContent = frame.before
    setTimeout(nextFrame, frame.time)
  }

  nextFrame()
}

const homepageAnimationEl: HTMLElement | null = document.querySelector(
  '#home-animation-text'
)
const reducedMotionReduce: MediaQueryList = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
)

if (homepageAnimationEl) {
  const animatedWords = getMeta('ol-homepageAnimatedWords') || []

  if (animatedWords.length > 0) {
    if (reducedMotionReduce.matches) {
      homepageAnimationEl.textContent = animatedWords[animatedWords.length - 1]
    } else {
      homepageAnimation(homepageAnimationEl, animatedWords)
    }
  }
}
