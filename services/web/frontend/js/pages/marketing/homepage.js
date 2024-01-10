import '../../marketing'

function realTimeEditsDemo() {
  const frames = [
    { before: '', time: 1000 },
    { before: 'i', time: 100 },
    { before: 'in', time: 200 },
    { before: 'in ', time: 300 },
    { before: 'in r', time: 100 },
    { before: 'in re', time: 200 },
    { before: 'in rea', time: 100 },
    { before: 'in real', time: 200 },
    { before: 'in real ', time: 400 },
    { before: 'in real t', time: 200 },
    { before: 'in real ti', time: 100 },
    { before: 'in real tim', time: 200 },
    { before: 'in real time', time: 2000 },
  ]
  let index = 0
  function nextFrame() {
    const frame = frames[index]
    index = (index + 1) % frames.length

    $('.real-time-example').html(frame.before + "<div class='cursor'>|</div>")
    setTimeout(nextFrame, frame.time)
  }

  nextFrame()
}
realTimeEditsDemo()

function homepageAnimation() {
  function createFrames(word, { buildTime, holdTime, breakTime }) {
    const frames = []
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
    frames.push({ before: '', time: holdTime })

    return frames
  }

  const opts = {
    buildTime: 100,
    holdTime: 1000,
    breakTime: 100,
  }

  const frames = [
    ...createFrames('articles', opts),
    ...createFrames('theses', opts),
    ...createFrames('reports', opts),
    ...createFrames('presentations', opts),
    ...createFrames('anything', opts),
  ]

  let index = 0
  function nextFrame() {
    const frame = frames[index]
    index = (index + 1) % frames.length

    $('#home-animation-text').html(frame.before)
    setTimeout(nextFrame, frame.time)
  }

  nextFrame()
}
homepageAnimation()
