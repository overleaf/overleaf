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
