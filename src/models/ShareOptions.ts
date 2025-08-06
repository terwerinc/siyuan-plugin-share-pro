/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

/**
 * 分享选项
 *
 * @author terwer
 * @since 1.12.0
 */
class ShareOptions {
  public passwordEnabled?: boolean
  public password?: string

  public constructor() {
    this.passwordEnabled = false
    this.password = ""
  }
}

export { ShareOptions }
