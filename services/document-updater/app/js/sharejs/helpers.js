/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// These methods let you build a transform function from a transformComponent function
// for OT types like text and JSON in which operations are lists of components
// and transforming them requires N^2 work.

// Add transform and transformX functions for an OT type which has transformComponent defined.
// transformComponent(destination array, component, other component, side)
let bootstrapTransform
exports._bt = bootstrapTransform = function (
  type,
  transformComponent,
  checkValidOp,
  append
) {
  let transformX
  const transformComponentX = function (left, right, destLeft, destRight) {
    transformComponent(destLeft, left, right, 'left')
    return transformComponent(destRight, right, left, 'right')
  }

  // Transforms rightOp by leftOp. Returns ['rightOp', clientOp']
  type.transformX =
    type.transformX =
    transformX =
      function (leftOp, rightOp) {
        checkValidOp(leftOp)
        checkValidOp(rightOp)

        const newRightOp = []

        for (let rightComponent of Array.from(rightOp)) {
          // Generate newLeftOp by composing leftOp by rightComponent
          const newLeftOp = []

          let k = 0
          while (k < leftOp.length) {
            var l
            const nextC = []
            transformComponentX(leftOp[k], rightComponent, newLeftOp, nextC)
            k++

            if (nextC.length === 1) {
              rightComponent = nextC[0]
            } else if (nextC.length === 0) {
              for (l of Array.from(leftOp.slice(k))) {
                append(newLeftOp, l)
              }
              rightComponent = null
              break
            } else {
              // Recurse.
              const [l_, r_] = Array.from(transformX(leftOp.slice(k), nextC))
              for (l of Array.from(l_)) {
                append(newLeftOp, l)
              }
              for (const r of Array.from(r_)) {
                append(newRightOp, r)
              }
              rightComponent = null
              break
            }
          }

          if (rightComponent != null) {
            append(newRightOp, rightComponent)
          }
          leftOp = newLeftOp
        }

        return [leftOp, newRightOp]
      }

  // Transforms op with specified type ('left' or 'right') by otherOp.
  return (type.transform = type.transform =
    function (op, otherOp, type) {
      let _
      if (type !== 'left' && type !== 'right') {
        throw new Error("type must be 'left' or 'right'")
      }

      if (otherOp.length === 0) {
        return op
      }

      // TODO: Benchmark with and without this line. I _think_ it'll make a big difference...?
      if (op.length === 1 && otherOp.length === 1) {
        return transformComponent([], op[0], otherOp[0], type)
      }

      if (type === 'left') {
        let left
        ;[left, _] = Array.from(transformX(op, otherOp))
        return left
      } else {
        let right
        ;[_, right] = Array.from(transformX(otherOp, op))
        return right
      }
    })
}

if (typeof WEB === 'undefined') {
  exports.bootstrapTransform = bootstrapTransform
}
