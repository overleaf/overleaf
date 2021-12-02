function setSplitTestVariant(locals, splitTestName, variant) {
  if (!locals.splitTestVariants) {
    locals.splitTestVariants = {}
  }
  locals.splitTestVariants[splitTestName] = variant
}

module.exports = {
  setSplitTestVariant,
}
