/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */
import ShareProPlugin from "./index"
import { Topbar } from "./topbar"

class Main {
  private pluginInstance: ShareProPlugin
  private topbar: Topbar

  constructor(pluginInstance: ShareProPlugin) {
    this.pluginInstance = pluginInstance
    this.topbar = new Topbar(pluginInstance)
  }

  public start() {
    this.topbar.initTopbar()
  }
}

export { Main }
