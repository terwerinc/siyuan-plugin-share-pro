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
  /**
   * 是否跳过单文档提示消息（handleOne 层级）
   * 批量操作时设为 true，避免 toast 爆炸
   */
  public skipMsg?: boolean
  /**
   * 是否跳过批量汇总提示消息（createShare/batchProcessDocuments 层级）
   * 增量分享服务调用时设为 true，由上层统一显示汇总
   */
  public skipBatchMsg?: boolean

  public constructor() {
    this.passwordEnabled = false
    this.password = ""
    this.skipMsg = false
    this.skipBatchMsg = false
  }
}

export { ShareOptions }
