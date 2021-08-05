export default function withoutPropagation(callback) {
  return ev => {
    ev.stopPropagation()
    if (callback) callback(ev)
  }
}
