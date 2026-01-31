# QA: Live Sold/Amount in Daily Box Entry

**Status: Fixed** (entriesSyncKey stabilized with `useMemo` in admin and staff dashboards.)

## Issue
Live preview (Sold and Amount updating as the user types Open/Close) was not visible in the daily box entry table.

## Root cause

1. **Sync effect overwrote user input on every re-render**
   - `entriesSyncKey` was computed on every render: `sortedBoxes.map(...).join(';')`, producing a **new string reference** each time.
   - `useEffect(..., [entriesSyncKey])` runs when the dependency **reference** changes. With a new string every render, the effect could run after the user typed, overwriting `formValues` with server data (`openDisplay(entry)`, `closeDisplay(entry)`), i.e. wiping the typed value and replacing it with "-" or the old value.
   - Result: user types → `setFormValues` runs → re-render → new `entriesSyncKey` string → effect runs → `setFormValues` overwrites with server data → Sold/Amount never reflect the typed value.

2. **Fix**
   - Make `entriesSyncKey` **stable** so it only changes when server data actually changes:
     - Wrap it in `useMemo(..., [entries, activatedBooksForDate, boxes])`.
     - When the user only types, `entries` / `boxes` / `activatedBooksForDate` do not change, so `useMemo` returns the same key and the sync effect does **not** run.
     - When the date changes or after save, `entries` (and possibly others) change, so the key updates and the effect runs once to sync form from server.

## Changes made

- **Admin** (`app/admin/dashboard/client.tsx`): Added `useMemo` import; `entriesSyncKey` is now `useMemo(..., [entries, activatedBooksForDate, boxes])`.
- **Staff** (`app/staff/dashboard/client.tsx`): Same change.

## Verification

1. Go to **Entry** → **Box Entries** (admin or staff).
2. Select today’s date (or a date that is not submitted).
3. In one row, type a number in **Open #** (e.g. `10`) and **Close #** (e.g. `5`).
4. **Sold** and **Amount** should update immediately (e.g. Sold = 6, Amount = ticket value × 6) without saving.
5. Typing more or changing values should keep updating Sold/Amount live.
6. After **Save all entries**, values should persist and the same live behavior should work for further edits.

## Other checks (no bugs found)

- `formValues` and Sold/Amount are in the same component (`DailyBoxEntrySheet`), so they share state.
- `setBoxValue` updates `formValues` correctly and preserves other fields.
- Sold/Amount are computed from current `v.open`, `v.close`, `v.newBoxStart` (with `?? 0` for nulls).
- Table reads `formValues[box.id]` with safe defaults (`raw?.open ?? ''`, etc.).
- Sold/Amount columns are the sticky right columns; scroll right if the table is wide.
