import { expect } from 'chai'
import {
  parseMentions,
  sliceMentionSegments,
} from '@/features/review-panel/utils/parse-mentions'
import { UserId } from '@ol-types/user'

describe('parseMentions', function () {
  it('should return a single text segment for plain text', function () {
    expect(parseMentions('hello world')).to.deep.equal([
      { type: 'text', value: 'hello world' },
    ])
  })

  it('should return an empty array for an empty string', function () {
    expect(parseMentions('')).to.deep.equal([])
  })

  it('should parse a single mention', function () {
    const userId = 'aabbccddeeff00112233aabb' as UserId
    expect(parseMentions(`@[${userId}]`)).to.deep.equal([
      { type: 'mention', userId },
    ])
  })

  it('should parse text before and after a mention', function () {
    const userId = 'aabbccddeeff00112233aabb' as UserId
    expect(parseMentions(`hey @[${userId}] check this`)).to.deep.equal([
      { type: 'text', value: 'hey ' },
      { type: 'mention', userId },
      { type: 'text', value: ' check this' },
    ])
  })

  it('should parse multiple mentions', function () {
    const userId1 = 'aabbccddeeff00112233aabb' as UserId
    const userId2 = '112233445566778899aabbcc' as UserId
    expect(parseMentions(`@[${userId1}] and @[${userId2}]`)).to.deep.equal([
      { type: 'mention', userId: userId1 },
      { type: 'text', value: ' and ' },
      { type: 'mention', userId: userId2 },
    ])
  })

  it('should not match bare @userId without brackets', function () {
    expect(parseMentions('@aabbccddeeff00112233aabb')).to.deep.equal([
      { type: 'text', value: '@aabbccddeeff00112233aabb' },
    ])
  })

  it('should not match @[...] with non-hex characters', function () {
    expect(parseMentions('@[gghhiijjkkllmmnnooppqqrr]')).to.deep.equal([
      { type: 'text', value: '@[gghhiijjkkllmmnnooppqqrr]' },
    ])
  })

  it('should not match @[...] with wrong length', function () {
    expect(parseMentions('@[aabbcc]')).to.deep.equal([
      { type: 'text', value: '@[aabbcc]' },
    ])
  })

  it('should handle adjacent mentions with no text between', function () {
    const userId1 = 'aabbccddeeff00112233aabb' as UserId
    const userId2 = '112233445566778899aabbcc' as UserId
    expect(parseMentions(`@[${userId1}]@[${userId2}]`)).to.deep.equal([
      { type: 'mention', userId: userId1 },
      { type: 'mention', userId: userId2 },
    ])
  })

  it('should handle a truncated mention as plain text', function () {
    expect(parseMentions('@[aabbccddeeff001122')).to.deep.equal([
      { type: 'text', value: '@[aabbccddeeff001122' },
    ])
  })
})

describe('sliceMentionSegments', function () {
  const userId = 'aabbccddeeff00112233aabb' as UserId

  it('should return all segments when under the limit', function () {
    const segments = parseMentions(`hi @[${userId}]`)
    const result = sliceMentionSegments(segments, 100)
    expect(result).to.deep.equal(segments)
  })

  it('should truncate a text segment at the limit', function () {
    const segments = parseMentions('hello world')
    const result = sliceMentionSegments(segments, 5)
    expect(result).to.deep.equal([{ type: 'text', value: 'hello' }])
  })

  it('should drop a mention that crosses the limit', function () {
    const segments = parseMentions(`hey @[${userId}]`)
    // "hey " = 4 chars, mention = 27 chars raw; limit 10 leaves only 6 for mention
    const result = sliceMentionSegments(segments, 10)
    expect(result).to.deep.equal([{ type: 'text', value: 'hey ' }])
  })

  it('should include a mention that fits exactly', function () {
    const segments = parseMentions(`hey @[${userId}]`)
    // "hey " = 4 chars, mention = 27 chars; limit = 31
    const result = sliceMentionSegments(segments, 31)
    expect(result).to.deep.equal(segments)
  })

  it('should return empty array when limit is 0', function () {
    const segments = parseMentions('hello')
    const result = sliceMentionSegments(segments, 0)
    expect(result).to.deep.equal([])
  })

  it('should handle a mention as the first segment', function () {
    const segments = parseMentions(`@[${userId}] done`)
    // mention = 27 chars; limit 27 fits the mention but not " done"
    const result = sliceMentionSegments(segments, 27)
    expect(result).to.deep.equal([{ type: 'mention', userId }])
  })

  it('should drop a leading mention that does not fit', function () {
    const segments = parseMentions(`@[${userId}] done`)
    const result = sliceMentionSegments(segments, 10)
    expect(result).to.deep.equal([])
  })

  it('should handle multiple segments with truncation mid-text', function () {
    const userId2 = '112233445566778899aabbcc' as UserId
    const segments = parseMentions(`@[${userId}] and @[${userId2}]`)
    // mention(27) + " and "(5) = 32; limit 35 leaves 3 chars but mention needs 27
    const result = sliceMentionSegments(segments, 35)
    expect(result).to.deep.equal([
      { type: 'mention', userId },
      { type: 'text', value: ' and ' },
    ])
  })
})
