export const DATA_VIEW_TYPES = ["table", "list", "gallery", "kanban", "calendar"] as const

export type DataViewType = (typeof DATA_VIEW_TYPES)[number]

export const isSupportedDataViewType = (value: unknown): value is DataViewType => {
  return typeof value === "string" && DATA_VIEW_TYPES.includes(value as DataViewType)
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
