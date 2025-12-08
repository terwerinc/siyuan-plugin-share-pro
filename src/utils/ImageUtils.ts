/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024-2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { SiyuanKernelApi } from "zhi-siyuan-api"

class ImageUtils {
  public static async getImageBase64FromSiyuan(
    kernelApi: SiyuanKernelApi,
    imageUrl: string
  ): Promise<{ status: number; msg: string; body: string; contentType: string }> {
    return await kernelApi.forwardProxy(imageUrl, [], undefined, "GET", undefined, undefined, "base64")
  }

  public static async fetchBase64WithContentType(
    url: string
  ): Promise<{ status: number; msg: string; body: string; contentType: string }> {
    try {
      // 发送请求
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      // 读取响应体为 Blob
      const blob = await response.blob()
      const contentType = blob.type
      // 创建 FileReader 对象
      const reader = new FileReader()

      // 读取 Blob 并转换为 Base64 字符串
      return new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = reader.result as string
          const base64String = base64.split(",")[1]
          resolve({ status: response.status, msg: response.statusText, body: base64String, contentType })
        }
        reader.onerror = () => {
          reject(reader.error)
        }
        reader.readAsDataURL(blob)
      })
    } catch (e) {
      return { status: 500, msg: "Error fetching and converting to Base64," + e, body: "", contentType: "" }
    }
  }
}
export { ImageUtils }
