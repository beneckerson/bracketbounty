

## Plan: Redirect Full Pools from Invite Link to Pool View

### Change
**`src/pages/JoinPool.tsx`** — In the `lookupPool` function, after detecting the pool is full, automatically redirect to `/pool/{id}` instead of showing the "This pool is full" error message.

Current behavior: User sees a dead-end "This pool is full" message.
New behavior: User lands on the read-only pool view (which we just made public).

The redirect happens right after the pool lookup completes and `isFull` is determined. We already have the `pool.id` at that point, so it's a simple `navigate(`/pool/${foundPool.id}`)` with a toast saying "This pool is full — viewing in read-only mode."

This also covers the case where an existing member clicks the invite link again — they'll either get redirected as an existing member (already implemented) or see the pool read-only.

### What stays the same
- If the pool is NOT full, the join form works as before
- The `/pool/{id}` page already supports public read-only access from the previous change

