/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

/**
 * 分页请求参数
 */
export interface PageDTO<T> {
  /**
   * 页码（从0开始）
   */
  pageNum: number

  /**
   * 每页大小
   */
  pageSize: number

  /**
   * 搜索关键词
   */
  search?: string
}

/**
 * 分页响应数据
 */
export interface PageResponseDTO<T> {
  /**
   * 总记录数
   */
  total: number

  /**
   * 每页大小
   */
  pageSize: number

  /**
   * 当前页码
   */
  pageNum: number

  /**
   * 总页数
   */
  totalPages: number

  /**
   * 数据列表
   */
  data: T[]

  /**
   * 排序字段
   */
  order?: string

  /**
   * 排序方向
   */
  direction?: string

  /**
   * 搜索关键词
   */
  search?: string
}

/**
 * 文档数据（嵌套在DocDTO中）
 */
export interface DocDataDTO {
  /**
   * 文档标题
   */
  title: string

  /**
   * 创建时间
   */
  dateCreated: string

  /**
   * 更新时间
   */
  dateUpdated: string
}

/**
 * 文档DTO（服务端返回的文档信息）
 */
export interface DocDTO {
  /**
   * 文档ID
   */
  docId: string

  /**
   * 作者
   */
  author: string

  /**
   * 文档域名
   */
  docDomain?: string

  /**
   * 文档数据
   */
  data: DocDataDTO

  /**
   * 媒体文件列表
   */
  media: any[]

  /**
   * 分享状态
   */
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"

  /**
   * 创建时间
   */
  createdAt: string
}
