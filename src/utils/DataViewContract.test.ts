import { describe, expect, it } from "vitest"
import { DATA_VIEW_TYPES, extractDataViewBlocks, normalizeDataViewEntry, resolveDataViewType } from "./DataViewContract"

describe("database view contract", () => {
  it("discovers all five real types once and ignores unknown or missing ids", () => {
    const html = [
      '<div data-av-type="table" data-av-id="db-1" custom-sy-av-view="v1"></div>',
      '<div data-av-type="table" data-av-id="db-1"></div>',
      '<div data-av-type="list" data-av-id="db-2"></div>',
      '<div data-av-type="gallery" data-av-id="db-3"></div>',
      '<div data-av-type="kanban" data-av-id="db-4"></div>',
      '<div data-av-type="calendar" data-av-id="db-5"></div>',
      '<div data-av-type="timeline" data-av-id="db-6"></div>',
      '<div data-av-type="table"></div>',
    ].join("")
    const blocks = extractDataViewBlocks(html)
    expect(blocks.map(block => block.dataAvType)).toEqual([...DATA_VIEW_TYPES])
    expect(blocks.map(block => block.dataTableId)).toEqual(["db-1", "db-2", "db-3", "db-4", "db-5"])
    expect(blocks[0].defaultViewId).toBe("v1")
  })

  it("accepts the five real view types", () => {
    for (const type of DATA_VIEW_TYPES) {
      expect(resolveDataViewType({ views: [{ id: "view-1", type }] }, "view-1")).toBe(type)
    }
  })

  it("keeps rows, cards, groups and calendar models unchanged", () => {
    const table = normalizeDataViewEntry({ views: [{ id: "table-1", type: "table" }], view: { columns: [], rows: [], rowCount: 0 } }, "table-1")
    const gallery = normalizeDataViewEntry({ views: [{ id: "gallery-1", type: "gallery" }], view: { fields: [], cards: [], cardCount: 0 } }, "gallery-1")
    const kanban = normalizeDataViewEntry({ views: [{ id: "kanban-1", type: "kanban" }], view: { groups: [], fields: [], cards: [] } }, "kanban-1")
    const calendar = normalizeDataViewEntry({ views: [{ id: "calendar-1", type: "calendar" }], view: { calendar: { dateKeyID: "date" }, rows: [] } }, "calendar-1")
    expect(table.view.rows).toEqual([])
    expect(gallery.view.cards).toEqual([])
    expect(kanban.view.groups).toEqual([])
    expect(calendar.view.calendar.dateKeyID).toBe("date")
  })

  it("rejects unknown or missing types instead of guessing table", () => {
    expect(resolveDataViewType({ views: [{ id: "view-1", type: "timeline" }] }, "view-1")).toBe("unknown")
    expect(resolveDataViewType({ view: { rows: [], columns: [] } }, "view-1")).toBe("unknown")
  })
})
