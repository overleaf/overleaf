text = require "../../../../app/js/sharejs/types/text"
require("chai").should()
RangesTracker = require "../../../../app/js/RangesTracker"

describe "ShareJS text type", ->
	beforeEach ->
		@t = "mock-thread-id"
		
	describe "transform", ->
		describe "insert / insert", ->
			it "with an insert before", ->
				dest = []
				text._tc(dest, { i: "foo", p: 9 }, { i: "bar", p: 3 })
				dest.should.deep.equal [{ i: "foo", p: 12 }]

			it "with an insert after", ->
				dest = []
				text._tc(dest, { i: "foo", p: 3 }, { i: "bar", p: 9 })
				dest.should.deep.equal [{ i: "foo", p: 3 }]

			it "with an insert at the same place with side == 'right'", ->
				dest = []
				text._tc(dest, { i: "foo", p: 3 }, { i: "bar", p: 3 }, 'right')
				dest.should.deep.equal [{ i: "foo", p: 6 }]

			it "with an insert at the same place with side == 'left'", ->
				dest = []
				text._tc(dest, { i: "foo", p: 3 }, { i: "bar", p: 3 }, 'left')
				dest.should.deep.equal [{ i: "foo", p: 3 }]

		describe "insert / delete", ->
			it "with a delete before", ->
				dest = []
				text._tc(dest, { i: "foo", p: 9 }, { d: "bar", p: 3 })
				dest.should.deep.equal [{ i: "foo", p: 6 }]

			it "with a delete after", ->
				dest = []
				text._tc(dest, { i: "foo", p: 3 }, { d: "bar", p: 9 })
				dest.should.deep.equal [{ i: "foo", p: 3 }]

			it "with a delete at the same place with side == 'right'", ->
				dest = []
				text._tc(dest, { i: "foo", p: 3 }, { d: "bar", p: 3 }, 'right')
				dest.should.deep.equal [{ i: "foo", p: 3 }]

			it "with a delete at the same place with side == 'left'", ->
				dest = []
				
				text._tc(dest, { i: "foo", p: 3 }, { d: "bar", p: 3 }, 'left')
				dest.should.deep.equal [{ i: "foo", p: 3 }]

		describe "delete / insert", ->
			it "with an insert before", ->
				dest = []
				text._tc(dest, { d: "foo", p: 9 }, { i: "bar", p: 3 })
				dest.should.deep.equal [{ d: "foo", p: 12 }]

			it "with an insert after", ->
				dest = []
				text._tc(dest, { d: "foo", p: 3 }, { i: "bar", p: 9 })
				dest.should.deep.equal [{ d: "foo", p: 3 }]

			it "with an insert at the same place with side == 'right'", ->
				dest = []
				text._tc(dest, { d: "foo", p: 3 }, { i: "bar", p: 3 }, 'right')
				dest.should.deep.equal [{ d: "foo", p: 6 }]

			it "with an insert at the same place with side == 'left'", ->
				dest = []
				text._tc(dest, { d: "foo", p: 3 }, { i: "bar", p: 3 }, 'left')
				dest.should.deep.equal [{ d: "foo", p: 6 }]
			
			it "with a delete that overlaps the insert location", ->
				dest = []
				text._tc(dest, { d: "foo", p: 3 }, { i: "bar", p: 4 })
				dest.should.deep.equal [{ d: "f", p: 3 }, { d: "oo", p: 6 }]
				

		describe "delete / delete", ->
			it "with a delete before", ->
				dest = []
				text._tc(dest, { d: "foo", p: 9 }, { d: "bar", p: 3 })
				dest.should.deep.equal [{ d: "foo", p: 6 }]

			it "with a delete after", ->
				dest = []
				text._tc(dest, { d: "foo", p: 3 }, { d: "bar", p: 9 })
				dest.should.deep.equal [{ d: "foo", p: 3 }]

			it "with deleting the same content", ->
				dest = []
				text._tc(dest, { d: "foo", p: 3 }, { d: "foo", p: 3 }, 'right')
				dest.should.deep.equal []

			it "with the delete overlapping before", ->
				dest = []
				text._tc(dest, { d: "foobar", p: 3 }, { d: "abcfoo", p: 0 }, 'right')
				dest.should.deep.equal [{ d: "bar", p: 0 }]

			it "with the delete overlapping after", ->
				dest = []
				text._tc(dest, { d: "abcfoo", p: 3 }, { d: "foobar", p: 6 })
				dest.should.deep.equal [{ d: "abc", p: 3 }]

			it "with the delete overlapping the whole delete", ->
				dest = []
				text._tc(dest, { d: "abcfoo123", p: 3 }, { d: "foo", p: 6 })
				dest.should.deep.equal [{ d: "abc123", p: 3 }]

			it "with the delete inside the whole delete", ->
				dest = []
				text._tc(dest, { d: "foo", p: 6 }, { d: "abcfoo123", p: 3 })
				dest.should.deep.equal []
	
		describe "comment / insert", ->
			it "with an insert before", ->
				dest = []
				text._tc(dest, { c: "foo", p: 9, @t }, { i: "bar", p: 3 })
				dest.should.deep.equal [{ c: "foo", p: 12, @t }]

			it "with an insert after", ->
				dest = []
				text._tc(dest, { c: "foo", p: 3, @t }, { i: "bar", p: 9 })
				dest.should.deep.equal [{ c: "foo", p: 3, @t }]

			it "with an insert at the left edge", ->
				dest = []
				text._tc(dest, { c: "foo", p: 3, @t }, { i: "bar", p: 3 })
				# RangesTracker doesn't inject inserts into comments on edges, so neither should we
				dest.should.deep.equal [{ c: "foo", p: 6, @t }]

			it "with an insert at the right edge", ->
				dest = []
				text._tc(dest, { c: "foo", p: 3, @t }, { i: "bar", p: 6 })
				# RangesTracker doesn't inject inserts into comments on edges, so neither should we
				dest.should.deep.equal [{ c: "foo", p: 3, @t }]

			it "with an insert in the middle", ->
				dest = []
				text._tc(dest, { c: "foo", p: 3, @t }, { i: "bar", p: 5 })
				dest.should.deep.equal [{ c: "fobaro", p: 3, @t }]
	
		describe "comment / delete", ->
			it "with a delete before", ->
				dest = []
				text._tc(dest, { c: "foo", p: 9, @t }, { d: "bar", p: 3 })
				dest.should.deep.equal [{ c: "foo", p: 6, @t }]

			it "with a delete after", ->
				dest = []
				text._tc(dest, { c: "foo", p: 3, @t }, { i: "bar", p: 9 })
				dest.should.deep.equal [{ c: "foo", p: 3, @t }]

			it "with a delete overlapping the comment content before", ->
				dest = []
				text._tc(dest, { c: "foobar", p: 6, @t }, { d: "123foo", p: 3 })
				dest.should.deep.equal [{ c: "bar", p: 3, @t }]

			it "with a delete overlapping the comment content after", ->
				dest = []
				text._tc(dest, { c: "foobar", p: 6, @t }, { d: "bar123", p: 9 })
				dest.should.deep.equal [{ c: "foo", p: 6, @t }]

			it "with a delete overlapping the comment content in the middle", ->
				dest = []
				text._tc(dest, { c: "foo123bar", p: 6, @t }, { d: "123", p: 9 })
				dest.should.deep.equal [{ c: "foobar", p: 6, @t }]

			it "with a delete overlapping the whole comment", ->
				dest = []
				text._tc(dest, { c: "foo", p: 6, @t }, { d: "123foo456", p: 3 })
				dest.should.deep.equal [{ c: "", p: 3, @t }]
	
		describe "comment / insert", ->
			it "should not do anything", ->
				dest = []
				text._tc(dest, { i: "foo", p: 6 }, { c: "bar", p: 3 })
				dest.should.deep.equal [{ i: "foo", p: 6 }]
	
		describe "comment / delete", ->
			it "should not do anything", ->
				dest = []
				text._tc(dest, { d: "foo", p: 6 }, { c: "bar", p: 3 })
				dest.should.deep.equal [{ d: "foo", p: 6 }]
	
		describe "comment / comment", ->
			it "should not do anything", ->
				dest = []
				text._tc(dest, { c: "foo", p: 6 }, { c: "bar", p: 3 })
				dest.should.deep.equal [{ c: "foo", p: 6 }]

	describe "apply", ->
		it "should apply an insert", ->
			text.apply("foo", [{ i: "bar", p: 2 }]).should.equal "fobaro"

		it "should apply a delete", ->
			text.apply("foo123bar", [{ d: "123", p: 3 }]).should.equal "foobar"

		it "should do nothing with a comment", ->
			text.apply("foo123bar", [{ c: "123", p: 3 }]).should.equal "foo123bar"
		
		it "should throw an error when deleted content does not match", ->
			(() ->
				text.apply("foo123bar", [{ d: "456", p: 3 }])
			).should.throw(Error)
		
		it "should throw an error when comment content does not match", ->
			(() ->
				text.apply("foo123bar", [{ c: "456", p: 3 }])
			).should.throw(Error)
	
	describe "applying ops and comments in different orders", ->
		it "should not matter which op or comment is applied first", ->
			transform = (op1, op2, side) ->
				d = []
				text._tc(d, op1, op2, side)
				return d
			
			applySnapshot = (snapshot, op) ->
				return text.apply(snapshot, op)
			
			applyRanges = (rangesTracker, ops) ->
				for op in ops
					rangesTracker.applyOp(op, {})
				return rangesTracker
			
			commentsEqual = (comments1, comments2) ->
				return false if comments1.length != comments2.length
				comments1.sort (a,b) ->
					if a.offset - b.offset == 0
						return a.length - b.length
					else
						return a.offset - b.offset
				comments2.sort (a,b) ->
					if a.offset - b.offset == 0
						return a.length - b.length
					else
						return a.offset - b.offset
				for comment1, i in comments1
					comment2 = comments2[i]
					if comment1.offset != comment2.offset or comment1.length != comment2.length
						return false
				return true
			
			SNAPSHOT = "123"
			
			OPS = []
			# Insert ops
			for p in [0..SNAPSHOT.length]
				OPS.push {i: "a", p: p}
				OPS.push {i: "bc", p: p}
			for p in [0..(SNAPSHOT.length-1)]
				for length in [1..(SNAPSHOT.length - p)]
					OPS.push {d: SNAPSHOT.slice(p, p+length), p}
			for p in [0..(SNAPSHOT.length-1)]
				for length in [1..(SNAPSHOT.length - p)]
					OPS.push {c: SNAPSHOT.slice(p, p+length), p, @t}

			for op1 in OPS
				for op2 in OPS
					op1_t = transform(op1, op2, "left")
					op2_t = transform(op2, op1, "right")
					
					rt12 = new RangesTracker()
					snapshot12 = applySnapshot(applySnapshot(SNAPSHOT, [op1]), op2_t)
					applyRanges(rt12, [op1])
					applyRanges(rt12, op2_t)
					
					rt21 = new RangesTracker()
					snapshot21 = applySnapshot(applySnapshot(SNAPSHOT, [op2]), op1_t)
					applyRanges(rt21, [op2])
					applyRanges(rt21, op1_t)
					
					if snapshot12 != snapshot21
						console.error {op1, op2, op1_t, op2_t, snapshot12, snapshot21}, "Ops are not consistent"
						throw new Error("OT is inconsistent")
					
					if !commentsEqual(rt12.comments, rt21.comments)
						console.log rt12.comments
						console.log rt21.comments
						console.error {op1, op2, op1_t, op2_t, rt12_comments: rt12.comments, rt21_comments: rt21.comments}, "Comments are not consistent"
						throw new Error("OT is inconsistent")
