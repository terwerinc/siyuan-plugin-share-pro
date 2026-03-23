import EventEmitter from "eventemitter3"

export const resourceEventEmitter = new EventEmitter()

export const RESOURCE_EVENTS = {
  START: "resource:start",
  PROGRESS: "resource:progress",
  ERROR: "resource:error",
  COMPLETE: "resource:complete",
}
