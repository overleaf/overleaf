function setSplitTestVariant(locals, splitTestName, variant) {
  if (!locals.splitTestVariants) {
    locals.splitTestVariants = {}
  }
  locals.splitTestVariants[splitTestName] = variant
}

function setSplitTestInfo(locals, splitTestName, info) {
  if (!locals.splitTestInfo) {
    locals.splitTestInfo = {}
  }
  locals.splitTestInfo[splitTestName] = info
}

export default {
  setSplitTestVariant,
  setSplitTestInfo,
}
