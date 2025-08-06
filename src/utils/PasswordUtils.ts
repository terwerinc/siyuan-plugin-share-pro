/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

/**
 * 密码工具类
 *
 * @author terwer
 * @since 1.13.0
 */
export class PasswordUtils {
  /**
   * 生成随机密码
   * 
   * @returns 随机密码字符串
   * @author terwer
   * @since 1.13.0
   */
  static getNewRndPassword(): string {
    return Math.random().toString(36).substring(2, 15)
  }
} 