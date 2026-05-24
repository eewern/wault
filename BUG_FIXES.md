# Bug Fixes for Notion Workspace Editor

## Bug 1: Items Reappearing After Delete

### Root Cause
The delete function works correctly (`rem(id)` filters out items), but items reappear because:

1. **Default data not being overridden** - When workspace loads, default items keep coming back
2. **State not persisting** - Delete happens in UI but isn't saved to Firebase/localStorage
3. **Refresh reloads old state** - Page refresh brings back deleted items from storage

### Solution

**Fix A: Prevent Default Data Reinsertion**

In `workspace-blocks.jsx`, before rendering list items, filter out empty/default items that user didn't add:

```javascript
// In BulletsBlock and NumbersBlock, before the map():
const userItems = block.items.filter(item => {
  // Keep items that have text OR were explicitly created by user
  return item.text?.trim() || item.hasUserContent;
});

// Then map userItems instead of block.items
{userItems.map((item, index) => {
```

**Fix B: Ensure Delete Persists to Storage**

In the `rem` function, make sure updateBlock triggers a save:

```javascript
const rem = (id) => {
  const next = block.items.filter(i => i.id !== id);
  updateBlock({ ...block, items: next });
  // Force persistence
  setTimeout(() => {
    // Trigger Firebase/localStorage sync
    window.notifyDataChanged?.();
  }, 100);
};
```

**Fix C: Clear Empty Default Items on Load**

In `workspace-app.jsx`, clean up empty items when loading a page:

```javascript
const loadLocalWorkspaceData = (workspaceId) => {
  const stored = readJson(localWorkspaceDataKey(workspaceId), null);
  if (stored) {
    // Remove empty bullet/number items that are just defaults
    const cleaned = {
      ...normalizeWorkspaceData(stored),
      pages: Object.fromEntries(
        Object.entries(stored.pages).map(([pageId, page]) => [
          pageId,
          {
            ...page,
            blocks: page.blocks.map(b => {
              if ((b.type === 'bullets' || b.type === 'numbers') && b.items) {
                return {
                  ...b,
                  items: b.items.filter(item => item.text?.trim() !== "")
                };
              }
              return b;
            })
          }
        ])
      )
    };
    return cleaned;
  }
  // ...rest of function
};
```

---

## Bug 2: Enter Key Behavior (Create Line Before Current Line)

### Current Behavior
When user presses Enter at the start of a line (caretPos === 0), it adds a line AFTER with `addBefore()`.

### Desired Behavior
1. User presses Enter at start of line
2. Create NEW empty line BEFORE current line
3. Current line's text stays on current line
4. Cursor moves to the new empty line

### Fix

In **BulletsBlock** (line 1086) and **NumbersBlock** (line 1234):

**Current code:**
```javascript
onEnter={(_, caretPos) => {
  if (isBlankText(item.text)) {
    if (level > 0) { upd(item.id, { level: level - 1 }); return; }
    const lifted = liftListItemToTextBlocks(block, item.id, "", level);
    onReplaceBlock?.(lifted.blocks, lifted.focusId);
    return;
  }
  if (caretPos === 0) return addBefore(item.id);  // ← This is correct!
  addAfter(item.id, level);
}}
```

Actually, the code IS correct! But the issue might be that `addBefore()` doesn't work properly. Let me check the implementation:

**Check addBefore function:**

```javascript
const addBefore = (id) => {
  const idx = block.items.findIndex(i => i.id === id);
  const newItem = { id: nid(), text:"", level: listLevel(block.items[idx]) };
  const next = [...block.items];
  next.splice(Math.max(0, idx), 0, newItem);  // ← Insert at idx (before current)
  updateBlock({ ...block, items: next.map(itemWithLevel) });
  setFocusItemId(newItem.id);
};
```

This SHOULD work correctly. BUT the issue might be that the previous line isn't formatted as a plain text block.

### Enhanced Fix: Ensure Previous Line is Text Block

**Add validation before and after adding line:**

```javascript
const addBefore = (id) => {
  const idx = block.items.findIndex(i => i.id === id);
  const prevItem = block.items[idx - 1];
  
  // Ensure previous item is a text block (not formatted)
  if (prevItem && idx > 0) {
    // Make sure previous item doesn't have special formatting
    const cleanedPrev = {
      ...prevItem,
      bold: false,
      italic: false,
      strikethrough: false
    };
    // Update if different
    if (JSON.stringify(prevItem) !== JSON.stringify(cleanedPrev)) {
      block.items[idx - 1] = cleanedPrev;
    }
  }
  
  const newItem = { 
    id: nid(), 
    text:"", 
    level: listLevel(block.items[idx]),
    // Ensure new item is plain text (no formatting)
    bold: false,
    italic: false,
    strikethrough: false
  };
  
  const next = [...block.items];
  next.splice(Math.max(0, idx), 0, newItem);
  updateBlock({ ...block, items: next.map(itemWithLevel) });
  setFocusItemId(newItem.id);
};
```

### Alternative: If Issue is About Text Mode

If the problem is that users want a PLAIN TEXT block (not a bullet), modify onEnter:

```javascript
onEnter={(_, caretPos) => {
  if (isBlankText(item.text)) {
    if (level > 0) { upd(item.id, { level: level - 1 }); return; }
    const lifted = liftListItemToTextBlocks(block, item.id, "", level);
    onReplaceBlock?.(lifted.blocks, lifted.focusId);
    return;
  }
  
  if (caretPos === 0) {
    // User pressed Enter at start
    // Split current item: move text to new line below, create empty line above
    const splitText = item.text;
    
    // Update current item to be empty
    upd(item.id, "");
    
    // Add item after with the original text
    setTimeout(() => {
      addAfter(item.id, level);
    }, 0);
    return;
  }
  
  // Normal: add after
  addAfter(item.id, level);
}}
```

---

## Summary of Fixes Needed

### Bug 1 (Delete Reappearing)
1. ✅ Filter empty default items on load
2. ✅ Force persistence after delete
3. ✅ Clean up storage when loading

### Bug 2 (Enter Key)
1. ✅ The code LOOKS correct (`addBefore` is called)
2. ⚠️ Issue might be timing or focus management
3. ⚠️ Or previous line isn't formatted as plain text

---

## Questions for Debugging

Before I implement these, can you confirm:

1. **Delete Bug**: When you delete an item and refresh the page, does it come back? Or does it reappear in the UI without refresh?

2. **Enter Key Bug**: When you press Enter before the first letter:
   - Does the new line appear but with formatting?
   - Or does nothing happen?
   - Or does it create a line after instead of before?

This will help me fix it precisely.
