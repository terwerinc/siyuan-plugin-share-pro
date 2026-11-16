import * as cheerio from "cheerio"

export const DATA_VIEW_TYPES = ["table", "list", "gallery", "kanban", "calendar"] as const

export type DataViewType = (typeof DATA_VIEW_TYPES)[number]

export const isSupportedDataViewType = (value: unknown): value is DataViewType => {
  return typeof value === "string" && DATA_VIEW_TYPES.includes(value as DataViewType)
}

export type DataViewBlock = {
  dataTableId: string
  dataAvType: DataViewType
  defaultViewId?: string
}

export const extractDataViewBlocks = (editorDom: string): DataViewBlock[] => {
  const $ = cheerio.load(editorDom)
  const blocks: DataViewBlock[] = []
  const seen = new Set<string>()
  $("div[data-av-type]").each((_index, element) => {
    const dataAvType = $(element).attr("data-av-type")
    const dataTableId = $(element).attr("data-av-id")
    if (!dataTableId || !isSupportedDataViewType(dataAvType) || seen.has(dataTableId)) {
      return
    }
    seen.add(dataTableId)
    blocks.push({
      dataTableId,
      dataAvType,
      defaultViewId: $(element).attr("custom-sy-av-view"),
    })
  })
  return blocks
}

export const resolveDataViewType = (response: any, viewId?: string): DataViewType | "unknown" => {
  const listed = response?.views?.find((view: any) => view.id === viewId)
  const type = listed?.type || response?.viewType || response?.view?.type
  return isSupportedDataViewType(type) ? type : "unknown"
}

export const normalizeDataViewEntry = (response: any, viewId?: string) => {
  const viewType = resolveDataViewType(response, viewId)
  return {
    ...response,
    viewType,
    viewModelVersion: 1,
  }
}
