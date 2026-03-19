

## Plan: Make Pool Pages Publicly Viewable (Read-Only)

### Problem
When invited users click the pool link after the pool is full, they hit "Pool Not Found" because:
1. Their auth session may not be ready (race condition)
2. Their claim token got cleared when they registered
3. RLS blocks access since `is_pool_member` fails without a valid `auth.uid()`

The result: existing members get locked out of viewing their own pool.

### Solution
Make all pool pages publicly viewable by anyone with the link. The pool data isn't sensitive — it's scores and team assignments. Administrative actions (manage, edit) remain protected.

### Changes

**1. Database: Update 3 SECURITY DEFINER functions to allow unauthenticated access**

- **`get_pool_by_id_public`** — Remove the access check entirely. Anyone with a `pool_id` can read pool metadata.
- **`get_pool_members_public`** — Same: remove access check, return members for any pool.
- **`get_bracket_data_public`** — Same: remove access check, return bracket data for any pool.

These are already `SECURITY DEFINER` functions that bypass RLS, so we just remove the `IF` blocks that raise "Access denied."

**2. Frontend: Update `src/pages/Pool.tsx` — add public fallback**

Update `fetchPoolData` to add a third fallback path: if user is not authenticated AND there's no claim token, call the public functions anyway. The flow becomes:

1. Try authenticated direct query (RLS) → if success, done
2. Try claim token guest access → if success, done
3. **NEW**: Fall back to public read-only access via the same `get_pool_by_id_public` / `get_pool_members_public` / `get_bracket_data_public` functions with no claim token

Also update `fetchBracketData` to always use the public function (`get_bracket_data_public`) as a fallback when direct RLS queries fail, rather than only using it for guests.

**3. Frontend: Update `src/pages/JoinPool.tsx` — detect existing membership**

When looking up a pool, also check if the user is already a member. If so, redirect them to `/pool/{id}` instead of showing "pool is full."

### What stays protected
- Pool creation, updates, deletion — still require auth + creator check
- Manage drawer — still gated by `isCreator`
- Venmo handles — still masked by existing privacy rules
- Audit log writes — still require membership

