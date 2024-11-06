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
import { TopDialog } from "./topDialog"

class Main {
  private pluginInstance: ShareProPlugin
  // private topbar: Topbar
  private dlg: TopDialog

  constructor(pluginInstance: ShareProPlugin) {
    this.pluginInstance = pluginInstance
    // this.topbar = new Topbar(pluginInstance)
    this.dlg = new TopDialog(pluginInstance)
  }

  public start() {
    // this.topbar.initTopbar()
    this.dlg.initTopDialog()
  }
}

export { Main }
