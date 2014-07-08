# These methods let you build a transform function from a transformComponent function
# for OT types like text and JSON in which operations are lists of components
# and transforming them requires N^2 work.

# Add transform and transformX functions for an OT type which has transformComponent defined.
# transformComponent(destination array, component, other component, side)
exports['_bt'] = bootstrapTransform = (type, transformComponent, checkValidOp, append) ->
  transformComponentX = (left, right, destLeft, destRight) ->
    transformComponent destLeft, left, right, 'left'
    transformComponent destRight, right, left, 'right'

  # Transforms rightOp by leftOp. Returns ['rightOp', clientOp']
  type.transformX = type['transformX'] = transformX = (leftOp, rightOp) ->
    checkValidOp leftOp
    checkValidOp rightOp

    newRightOp = []

    for rightComponent in rightOp
      # Generate newLeftOp by composing leftOp by rightComponent
      newLeftOp = []

      k = 0
      while k < leftOp.length
        nextC = []
        transformComponentX leftOp[k], rightComponent, newLeftOp, nextC
        k++

        if nextC.length == 1
          rightComponent = nextC[0]
        else if nextC.length == 0
          append newLeftOp, l for l in leftOp[k..]
          rightComponent = null
          break
        else
          # Recurse.
          [l_, r_] = transformX leftOp[k..], nextC
          append newLeftOp, l for l in l_
          append newRightOp, r for r in r_
          rightComponent = null
          break
    
      append newRightOp, rightComponent if rightComponent?
      leftOp = newLeftOp
    
    [leftOp, newRightOp]

  # Transforms op with specified type ('left' or 'right') by otherOp.
  type.transform = type['transform'] = (op, otherOp, type) ->
    throw new Error "type must be 'left' or 'right'" unless type == 'left' or type == 'right'

    return op if otherOp.length == 0

    # TODO: Benchmark with and without this line. I _think_ it'll make a big difference...?
    return transformComponent [], op[0], otherOp[0], type if op.length == 1 and otherOp.length == 1

    if type == 'left'
      [left, _] = transformX op, otherOp
      left
    else
      [_, right] = transformX otherOp, op
      right

if typeof WEB is 'undefined'
  exports.bootstrapTransform = bootstrapTransform
