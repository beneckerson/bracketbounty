

## Plan: Show Original Team Draw in History

### Current State
The `teams_assigned` audit log entry already stores the full original assignments in its payload (`assignments: [{ member_name, team_abbreviation }]`). However, the History drawer only shows a summary line: "Teams randomly assigned to X players."

### Approach
Enhance the AuditDrawer to show an expandable "Original Draw" section when a `teams_assigned` log entry is present. Clicking it reveals the full list of initial assignments grouped by member.

### Changes

**1. `src/lib/audit-utils.ts`** — Pass through raw payload for `teams_assigned`

Add the raw `payload` to the `AuditLogEntry` return so the drawer can access the assignments array. Update the `AuditLogEntry` type in `types.ts` to include an optional `payload` field.

**2. `src/lib/types.ts`** — Add optional `payload` to `AuditLogEntry`

```typescript
payload?: Record<string, unknown>;
```

**3. `src/components/bracket/AuditDrawer.tsx`** — Render expandable original draw

For `teams_assigned` entries, render a collapsible section below the description showing assignments grouped by member name with team abbreviation pills. Uses the existing Collapsible component.

### Visual Treatment
```text
┌──────────────────────────────────┐
│ Teams randomly assigned (4)      │
│ Mar 19, 2025 • 8:30 PM          │
│                                  │
│ ▼ View Original Draw             │
│ ┌──────────────────────────────┐ │
│ │ Rich: [DUKE] [UNC] [BAYLOR] │ │
│ │ Mike: [GONZ] [HOUS] [PURD]  │ │
│ │ Sara: [CONN] [ARIZ] [TENN]  │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

### No database changes needed
The payload data already exists in `audit_log`.

