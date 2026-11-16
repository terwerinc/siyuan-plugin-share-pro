import { describe, expect, it } from "vitest"
import { DATA_VIEW_TYPES, normalizeDataViewEntry, resolveDataViewType } from "./DataViewContract"

describe("database view contract", () => {
  it("accepts the five real view types", () => {
    expect(DATA_VIEW_TYPES).toEqual(["table", "list", "gallery", "kanban", "calendar"])
    for (const type of DATA_VIEW_TYPES) {
      expect(resolveDataViewType({ views: [{ id: "view-1", type }] }, "view-1")).toBe(type)
    }
  })

  it("keeps type-specific response models unchanged", () => {
    const gallery = normalizeDataViewEntry({ views: [{ id: "gallery-1", type: "gallery" }], view: { fields: [], cards: [], cardCount: 0 } }, "gallery-1")
    const kanban = normalizeDataViewEntry({ views: [{ id: "kanban-1", type: "kanban" }], view: { groups: [], fields: [], cards: [] } }, "kanban-1")
    const calendar = normalizeDataViewEntry({ views: [{ id: "calendar-1", type: "calendar" }], view: { calendar: { dateKeyID: "date" }, rows: [] } }, "calendar-1")
    expect(gallery.view.fields).toEqual([])
    expect(gallery.view.cards).toEqual([])
    expect(kanban.view.groups).toEqual([])
    expect(calendar.view.calendar.dateKeyID).toBe("date")
    expect(gallery.viewType).toBe("gallery")
    expect(kanban.viewType).toBe("kanban")
    expect(calendar.viewType).toBe("calendar")
  })

  it("rejects unknown types instead of guessing table", () => {
    expect(resolveDataViewType({ views: [{ id: "view-1", type: "timeline" }] }, "view-1")).toBe("unknown")
    expect(resolveDataViewType({ view: { rows: [], columns: [] } }, "view-1")).toBe("unknown")
  })
})
