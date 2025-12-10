/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import SlugPlugin from "./index"

export const initStatusBar = (pluginInstance: SlugPlugin) => {
  const statusBarTemplate = document.createElement("template")
  statusBarTemplate.innerHTML = `<div class="toolbar__item b3-tooltips b3-tooltips__w" aria-label="upload picture status" style="font-size: 12px;"></div>`
  statusBarTemplate.content.firstElementChild.addEventListener("click", () => {})

  pluginInstance.statusBarElement = pluginInstance.addStatusBar({
    element: statusBarTemplate.content.firstElementChild as HTMLElement,
    position: "left",
  })
}

export const updateStatusBar = (pluginInstance: SlugPlugin, statusText) => {
  // console.log(pluginInstance.statusBarElement)
  pluginInstance.statusBarElement.innerHTML = `<div class="toolbar__item b3-tooltips b3-tooltips__w" aria-label="generate slug status" style="font-size: 12px;">${statusText}</div>`
}
