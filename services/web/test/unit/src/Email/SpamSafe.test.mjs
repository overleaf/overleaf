import SpamSafe from '../../../../app/src/Features/Email/SpamSafe.mjs'
import { expect } from 'vitest'

describe('SpamSafe', function () {
  it('should reject spammy names', function () {
    expect(SpamSafe.isSafeUserName('Charline Wałęsa')).to.equal(true)
    expect(
      SpamSafe.isSafeUserName(
        "hey come buy this product im selling it's really good for you and it'll make your latex 10x guaranteed"
      )
    ).to.equal(false)
    expect(SpamSafe.isSafeUserName('隆太郎 宮本')).to.equal(true)
    expect(SpamSafe.isSafeUserName('Visit haxx0red.com')).to.equal(false)
    expect(
      SpamSafe.isSafeUserName(
        '加美汝VX：hihi661，金沙2001005com the first deposit will be _100%_'
      )
    ).to.equal(false)
    expect(
      SpamSafe.isSafeProjectName(
        'Neural Networks: good for your health and will solve all your problems'
      )
    ).to.equal(false)
    expect(
      SpamSafe.isSafeProjectName(
        'An analysis of the questions of the universe!'
      )
    ).to.equal(true)
    expect(SpamSafe.isSafeProjectName("A'p'o's't'r'o'p'h'e gallore")).to.equal(
      true
    )
    expect(
      SpamSafe.isSafeProjectName(
        'come buy this => http://www.dopeproduct.com/search/?q=user123'
      )
    ).to.equal(false)
    expect(
      SpamSafe.isSafeEmail('realistic-email+1@domain.sub-hyphen.com')
    ).to.equal(true)
    expect(SpamSafe.isSafeEmail('jnd-9807408-1oos68@@example.com')).to.equal(
      false
    )
    expect(SpamSafe.isSafeEmail('123456789@example.com')).to.equal(true)
    expect(SpamSafe.isSafeEmail('abcdefghi@example.com')).to.equal(true)
    expect(SpamSafe.isSafeEmail('notquiteRight@evil$.com')).to.equal(false)

    expect(SpamSafe.safeUserName('Tammy Weinstįen', 'A User')).to.equal(
      'Tammy Weinstįen'
    )
    expect(SpamSafe.safeUserName('haxx0red.com', 'A User')).to.equal('A User')
    expect(SpamSafe.safeUserName('What$ Upp', 'A User')).to.equal('A User')
    expect(SpamSafe.safeProjectName('Math-ematics!', 'A Project')).to.equal(
      'Math-ematics!'
    )
    expect(
      SpamSafe.safeProjectName(
        `A Very long title for a very long book that will never be read${'a'.repeat(
          250
        )}`,
        'A Project'
      )
    ).to.equal('A Project')
    expect(SpamSafe.safeProjectName(`JND-123456-100s68`, 'A Project')).to.equal(
      'A Project'
    )
    expect(
      SpamSafe.safeProjectName(`JiAqun123456s100sf68`, 'A Project')
    ).to.equal('A Project')
    expect(
      SpamSafe.safeEmail('safe-ëmail@domain.com', 'A collaborator')
    ).to.equal('safe-ëmail@domain.com')
    expect(
      SpamSafe.safeEmail('Բարեւ@another.domain', 'A collaborator')
    ).to.equal('Բարեւ@another.domain')
    expect(
      SpamSafe.safeEmail(`me+${'a'.repeat(40)}@googoole.con`, 'A collaborator')
    ).to.equal('A collaborator')
    expect(
      SpamSafe.safeEmail('sendME$$$@iAmAprince.com', 'A collaborator')
    ).to.equal('A collaborator')
  })
})
