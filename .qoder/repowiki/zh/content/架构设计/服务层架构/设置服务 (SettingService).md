# 设置服务 (SettingService)

<cite>
**本文引用的文件**
- [src/service/SettingService.ts](file://src/service/SettingService.ts)
- [src/api/share-api.ts](file://src/api/share-api.ts)
- [src/models/ShareProConfig.ts](file://src/models/ShareProConfig.ts)
- [src/models/AppConfig.ts](file://src/models/AppConfig.ts)
- [src/models/SingleDocSetting.ts](file://src/models/SingleDocSetting.ts)
- [src/utils/SettingKeys.ts](file://src/utils/SettingKeys.ts)
- [src/utils/ShareConfigUtils.ts](file://src/utils/ShareConfigUtils.ts)
- [src/index.ts](file://src/index.ts)
- [src/service/ShareService.ts](file://src/service/ShareService.ts)
- [src/Constants.ts](file://src/Constants.ts)
- [src/i18n/zh_CN.json](file://src/i18n/zh_CN.json)
- [src/i18n/en_US.json](file://src/i18n/en_US.json)
- [plugin.json](file://plugin.json)
</cite>

## 更新摘要
**变更内容**
- 更新了国际化文件中的文档树提示文本，提供更清晰的用户指导
- 新增了ShareService.ts中的docTreeHierarchy属性，增强文档树层次结构处理能力
- 更新了文档树相关配置的说明和最佳实践

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖分析](#依赖分析)
7. [性能考虑](#性能考虑)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介
本文件系统性梳理"在线分享专业版"插件的设置服务（SettingService）与相关配置模型，覆盖配置生命周期（加载、验证、持久化、同步）、优先级规则（全局 vs 文档级）、默认值与迁移策略、热更新与实时生效检查、备份与恢复、以及配置与 UI 组件的双向绑定机制。目标是帮助开发者与高级用户正确理解并定制分享行为、SEO 优化、权限控制等。

**更新** 本次更新反映了最新的国际化改进和文档树层次结构处理能力增强。

## 项目结构
围绕设置服务的关键目录与文件如下：
- 服务层：SettingService 负责云端设置的同步与读取
- API 层：ShareApi 封装与后端服务的交互，包括设置的保存与查询
- 模型层：ShareProConfig、AppConfig、SingleDocSetting 描述配置结构
- 工具层：SettingKeys 定义文档级设置键；ShareConfigUtils 提供默认配置与同步工具
- 入口与持久化：index.ts 提供默认配置、安全加载与初始化逻辑
- 分享服务：ShareService 处理文档树层次结构的增强功能

```mermaid
graph TB
subgraph "入口与持久化"
IDX["index.ts<br/>默认配置/安全加载/initCfg"]
END
subgraph "服务层"
SS["SettingService.ts<br/>syncSetting/getSettingByAuthor"]
END
subgraph "API 层"
SA["share-api.ts<br/>saveSetting/getSettingByAuthor"]
END
subgraph "模型层"
SPC["ShareProConfig.ts"]
AC["AppConfig.ts"]
SDS["SingleDocSetting.ts"]
END
subgraph "工具层"
SK["SettingKeys.ts"]
SCU["ShareConfigUtils.ts<br/>DefaultAppConfig/syncAppConfig"]
END
subgraph "分享服务"
SSV["ShareService.ts<br/>docTreeHierarchy增强"]
CONST["Constants.ts<br/>DEFAULT_SHARE_REFERENCES_MAX_DEPTH"]
END
IDX --> SS
SS --> SA
SA --> SPC
SA --> AC
SA --> SDS
SCU --> SS
SCU --> AC
SK --> SDS
SSV --> CONST
```

**图表来源**
- [src/index.ts:100-178](file://src/index.ts#L100-L178)
- [src/service/SettingService.ts:18-36](file://src/service/SettingService.ts#L18-L36)
- [src/api/share-api.ts:79-102](file://src/api/share-api.ts#L79-L102)
- [src/models/ShareProConfig.ts:13-37](file://src/models/ShareProConfig.ts#L13-L37)
- [src/models/AppConfig.ts:12-85](file://src/models/AppConfig.ts#L12-L85)
- [src/models/SingleDocSetting.ts:18-82](file://src/models/SingleDocSetting.ts#L18-L82)
- [src/utils/SettingKeys.ts:13-72](file://src/utils/SettingKeys.ts#L13-L72)
- [src/utils/ShareConfigUtils.ts:16-82](file://src/utils/ShareConfigUtils.ts#L16-L82)
- [src/service/ShareService.ts:1006-1014](file://src/service/ShareService.ts#L1006-L1014)
- [src/Constants.ts:29](file://src/Constants.ts#L29)

**章节来源**
- [src/index.ts:100-178](file://src/index.ts#L100-L178)
- [src/service/SettingService.ts:18-36](file://src/service/SettingService.ts#L18-L36)
- [src/api/share-api.ts:79-102](file://src/api/share-api.ts#L79-L102)
- [src/models/ShareProConfig.ts:13-37](file://src/models/ShareProConfig.ts#L13-L37)
- [src/models/AppConfig.ts:12-85](file://src/models/AppConfig.ts#L12-L85)
- [src/models/SingleDocSetting.ts:18-82](file://src/models/SingleDocSetting.ts#L18-L82)
- [src/utils/SettingKeys.ts:13-72](file://src/utils/SettingKeys.ts#L13-L72)
- [src/utils/ShareConfigUtils.ts:16-82](file://src/utils/ShareConfigUtils.ts#L16-L82)

## 核心组件
- SettingService：对外暴露设置同步与按作者获取设置的能力，内部通过 ShareApi 与后端交互
- ShareApi：封装服务端接口调用，负责设置的保存与查询，同时负责校验服务端地址与令牌
- ShareProConfig：顶层配置容器，包含思源侧配置、服务端 API 配置、应用全局配置等
- AppConfig：应用全局配置，涵盖站点信息、主题、域名与路径、密码保护、子文档/引用文档分享、增量分享等
- SingleDocSetting：文档级设置，覆盖文档树/大纲开关与层级、过期时间、子文档/引用文档分享等
- SettingKeys：文档级设置键枚举，用于标记文档属性（如是否开启文档树、大纲、有效期等）
- ShareConfigUtils：提供默认 AppConfig、主题映射、以及将本地 AppConfig 同步到云端的工具函数
- ShareService：文档分享服务，增强文档树层次结构处理能力，支持docTreeHierarchy属性

**更新** 新增了ShareService及其docTreeHierarchy属性的说明。

**章节来源**
- [src/service/SettingService.ts:18-36](file://src/service/SettingService.ts#L18-L36)
- [src/api/share-api.ts:79-102](file://src/api/share-api.ts#L79-L102)
- [src/models/ShareProConfig.ts:13-37](file://src/models/ShareProConfig.ts#L13-L37)
- [src/models/AppConfig.ts:12-85](file://src/models/AppConfig.ts#L12-L85)
- [src/models/SingleDocSetting.ts:18-82](file://src/models/SingleDocSetting.ts#L18-L82)
- [src/utils/SettingKeys.ts:13-72](file://src/utils/SettingKeys.ts#L13-L72)
- [src/utils/ShareConfigUtils.ts:16-82](file://src/utils/ShareConfigUtils.ts#L16-L82)
- [src/service/ShareService.ts:1006-1014](file://src/service/ShareService.ts#L1006-L1014)

## 架构总览
设置服务的调用链路从 UI 触发，经由 SettingService 调用 ShareApi，最终落到服务端接口。配置的持久化由插件入口负责，首次加载时生成默认配置并写入存储。

```mermaid
sequenceDiagram
participant UI as "设置界面"
participant SS as "SettingService"
participant SA as "ShareApi"
participant Store as "插件存储"
participant Srv as "分享服务"
UI->>SS : "触发保存设置"
SS->>SA : "saveSetting(token, setting)"
SA->>Store : "读取服务端配置(apiUrl/token)"
SA->>Srv : "POST /api/settings/update"
Srv-->>SA : "返回结果(code/msg/data)"
SA-->>SS : "返回结果"
SS-->>UI : "提示成功/失败"
```

**图表来源**
- [src/service/SettingService.ts:29-31](file://src/service/SettingService.ts#L29-L31)
- [src/api/share-api.ts:90-102](file://src/api/share-api.ts#L90-L102)
- [src/index.ts:150-169](file://src/index.ts#L150-L169)

**章节来源**
- [src/service/SettingService.ts:29-31](file://src/service/SettingService.ts#L29-L31)
- [src/api/share-api.ts:90-102](file://src/api/share-api.ts#L90-L102)
- [src/index.ts:150-169](file://src/index.ts#L150-L169)

## 详细组件分析

### SettingService：设置同步与读取
- 职责
  - 提供云端设置同步能力：将本地或计算后的 AppConfig 发送到服务端
  - 提供按作者获取设置能力：用于跨设备或团队共享配置
- 关键方法
  - syncSetting(token, setting)：调用 ShareApi.saveSetting
  - getSettingByAuthor(author)：调用 ShareApi.getSettingByAuthor
- 依赖
  - ShareApi：封装网络请求与鉴权头
  - 插件实例：用于日志与上下文

**章节来源**
- [src/service/SettingService.ts:18-36](file://src/service/SettingService.ts#L18-L36)

### ShareApi：服务端交互与鉴权
- 职责
  - 将设置保存到服务端（/api/settings/update）
  - 按作者获取设置（/api/settings/byAuthor）
  - 统一封装鉴权头（Authorization）
  - 校验服务端地址与令牌，避免空配置导致的请求失败
- 关键实现要点
  - 从插件存储读取 ShareProConfig.serviceApiConfig，拼接请求 URL
  - 若服务端地址为空，直接提示错误并返回
  - 支持在开发模式下输出调试日志
- 与 SettingService 的协作
  - SettingService 仅负责调用，ShareApi 负责实际网络请求与错误处理

**章节来源**
- [src/api/share-api.ts:79-102](file://src/api/share-api.ts#L79-L102)
- [src/api/share-api.ts:173-209](file://src/api/share-api.ts#L173-L209)
- [src/index.ts:173-177](file://src/index.ts#L173-L177)

### ShareProConfig：顶层配置容器
- 字段概览
  - siyuanConfig：包含 apiUrl、token、cookie 及偏好设置（标题修复、文档树/大纲开关与层级）
  - serviceApiConfig：包含分享服务端的 apiUrl 与 token
  - appConfig：应用全局配置（AppConfig）
  - isCustomCssEnabled、isNewUIEnabled：功能开关
  - inited：初始化标志
- 作用
  - 作为插件存储的根对象，承载全局配置与服务端连接信息

**章节来源**
- [src/models/ShareProConfig.ts:13-37](file://src/models/ShareProConfig.ts#L13-L37)

### AppConfig：应用全局配置
- 字段概览（节选）
  - 站点信息：lang、siteUrl、siteTitle、siteSlogan、siteDescription、homePageId、header、footer、shareTemplate
  - 主题：mode、lightTheme、darkTheme、themeVersion、logo
  - 自定义 CSS：customCss 数组
  - 域名与路径：domains、domain、basePaths、docPath
  - 文档树/大纲：docTreeEnabled、docTreeLevel、outlineEnabled、outlineLevel
  - 密码保护：passwordEnabled、showPassword
  - 子文档分享：shareSubdocuments（专业版专属）
  - 引用文档分享：shareReferences（专业版专属）
  - 增量分享：incrementalShareConfig.enabled、lastShareTime、notebookBlacklist
  - 动态扩展：[key: string]: any
- 用途
  - 控制站点外观、导航、分享模板、SEO 相关字段
  - 控制分享范围与权限（域名、路径、密码）

**章节来源**
- [src/models/AppConfig.ts:12-85](file://src/models/AppConfig.ts#L12-L85)

### SingleDocSetting：文档级设置
- 字段概览（节选）
  - 文档树：docTreeEnable、docTreeLevel
  - 大纲：outlineEnable、outlineLevel
  - 有效期：expiresTime（秒，0 表示永久）
  - 子文档分享：shareSubdocuments
  - 子文档数量限制：maxSubdocuments（-1 表示无限制，最大 999）
  - 引用文档分享：shareReferences
- 用途
  - 在单篇文档分享时覆盖全局配置，实现细粒度控制

**章节来源**
- [src/models/SingleDocSetting.ts:18-82](file://src/models/SingleDocSetting.ts#L18-L82)

### SettingKeys：文档级设置键
- 作用
  - 定义文档属性键，确保文档级设置的统一命名与兼容性
- 关键键值（节选）
  - CUSTOM_DOC_TREE_ENABLE/CUSTOM_DOC_TREE_LEVEL：文档树开关与层级
  - CUSTOM_OUTLINE_ENABLE/CUSTOM_OUTLINE_LEVEL：大纲开关与层级
  - CUSTOM_EXPIRES：分享有效期
  - CUSTOM_SHARE_SUBDOCUMENTS/CUSTOM_SHARE_REFERENCES：子/引用文档分享开关
- 与 SingleDocSetting 的关系
  - SingleDocSetting 的字段与 SettingKeys 的键一一对应，便于序列化/反序列化与 UI 绑定

**章节来源**
- [src/utils/SettingKeys.ts:13-72](file://src/utils/SettingKeys.ts#L13-L72)
- [src/models/SingleDocSetting.ts:18-82](file://src/models/SingleDocSetting.ts#L18-L82)

### ShareConfigUtils：默认配置与同步工具
- DefaultAppConfig：提供 AppConfig 的默认值，包括语言、站点信息、主题、增量分享默认启用、子文档分享默认禁用等
- syncAppConfig：将本地 AppConfig 同步到云端，若返回 code 非 1 则抛出异常
- getSupportedThemes/versionMap：主题支持与版本映射，供 UI 展示与选择
- 与 SettingService 的协作
  - SettingService 调用 syncAppConfig 将 appConfig 同步到服务端

**章节来源**
- [src/utils/ShareConfigUtils.ts:16-82](file://src/utils/ShareConfigUtils.ts#L16-L82)

### ShareService：文档分享服务与文档树层次结构增强
- 职责
  - 处理文档分享的核心业务逻辑
  - 增强文档树层次结构处理能力，支持docTreeHierarchy属性
  - 管理子文档和引用文档的收集与扁平化
  - 处理媒体资源的上传与进度跟踪
- 关键实现要点
  - buildSharePost方法中新增docTreeHierarchy属性，提供更精确的文档树层次结构
  - 支持子文档分享和引用文档分享的组合处理
  - 实现批量处理和并发控制机制
  - 提供增量分享检测和性能优化
- 与配置系统的协作
  - 读取ShareProConfig进行配置验证
  - 应用AppConfig和SingleDocSetting的设置
  - 支持DEFAULT_SHARE_REFERENCES_MAX_DEPTH常量控制引用文档递归深度

**更新** 新增了ShareService的详细说明，重点介绍了docTreeHierarchy属性的增强功能。

**章节来源**
- [src/service/ShareService.ts:1006-1014](file://src/service/ShareService.ts#L1006-L1014)
- [src/service/ShareService.ts:124-160](file://src/service/ShareService.ts#L124-L160)
- [src/service/ShareService.ts:406-496](file://src/service/ShareService.ts#L406-L496)
- [src/Constants.ts:29](file://src/Constants.ts#L29)

### 插件入口与持久化：index.ts
- getDefaultCfg：生成默认配置（包含思源侧配置与服务端 API 配置），用于首次安装或重置
- safeLoad：安全加载配置，若存储不存在或格式异常则回退到默认配置
- initCfg：首次加载时设置 inited 标志并写回存储；开发模式下可自动修正服务端地址
- openSetting：打开设置对话框，渲染 ShareSetting UI 并传入插件实例与 VIP 信息

**章节来源**
- [src/index.ts:100-178](file://src/index.ts#L100-L178)

## 依赖分析
SettingService 与相关模块的依赖关系如下：

```mermaid
classDiagram
class SettingService {
+syncSetting(token, setting)
+getSettingByAuthor(author)
}
class ShareApi {
+saveSetting(token, setting)
+getSettingByAuthor(author)
}
class ShareProConfig {
+siyuanConfig
+serviceApiConfig
+appConfig
+inited
}
class AppConfig {
+lang
+siteUrl
+theme
+domains
+domain
+basePaths
+docPath
+docTreeEnabled
+docTreeLevel
+outlineEnabled
+outlineLevel
+passwordEnabled
+showPassword
+shareSubdocuments
+shareReferences
+incrementalShareConfig
}
class SingleDocSetting {
+docTreeEnable
+docTreeLevel
+outlineEnable
+outlineLevel
+expiresTime
+shareSubdocuments
+maxSubdocuments
+shareReferences
}
class ShareConfigUtils {
+DefaultAppConfig
+syncAppConfig(settingService, settingConfig)
+getSupportedThemes()
+versionMap
}
class ShareService {
+buildSharePost()
+flattenDocumentsForSharing()
+collectSubdocuments()
+collectReferencedDocuments()
}
class Constants {
+DEFAULT_SHARE_REFERENCES_MAX_DEPTH
}
SettingService --> ShareApi : "使用"
ShareApi --> ShareProConfig : "读取服务端配置"
ShareApi --> AppConfig : "保存/读取"
ShareApi --> SingleDocSetting : "文档级设置"
ShareConfigUtils --> SettingService : "提供默认配置/同步"
ShareConfigUtils --> AppConfig : "默认值"
ShareService --> ShareProConfig : "配置验证"
ShareService --> Constants : "引用深度控制"
```

**图表来源**
- [src/service/SettingService.ts:18-36](file://src/service/SettingService.ts#L18-L36)
- [src/api/share-api.ts:79-102](file://src/api/share-api.ts#L79-L102)
- [src/models/ShareProConfig.ts:13-37](file://src/models/ShareProConfig.ts#L13-L37)
- [src/models/AppConfig.ts:12-85](file://src/models/AppConfig.ts#L12-L85)
- [src/models/SingleDocSetting.ts:18-82](file://src/models/SingleDocSetting.ts#L18-L82)
- [src/utils/ShareConfigUtils.ts:16-82](file://src/utils/ShareConfigUtils.ts#L16-L82)
- [src/service/ShareService.ts:1006-1014](file://src/service/ShareService.ts#L1006-L1014)
- [src/Constants.ts:29](file://src/Constants.ts#L29)

**章节来源**
- [src/service/SettingService.ts:18-36](file://src/service/SettingService.ts#L18-L36)
- [src/api/share-api.ts:79-102](file://src/api/share-api.ts#L79-L102)
- [src/models/ShareProConfig.ts:13-37](file://src/models/ShareProConfig.ts#L13-L37)
- [src/models/AppConfig.ts:12-85](file://src/models/AppConfig.ts#L12-L85)
- [src/models/SingleDocSetting.ts:18-82](file://src/models/SingleDocSetting.ts#L18-L82)
- [src/utils/ShareConfigUtils.ts:16-82](file://src/utils/ShareConfigUtils.ts#L16-L82)

## 性能考虑
- 请求合并与去抖：在频繁变更设置时，建议在 UI 层进行防抖，减少不必要的网络请求
- 本地缓存：利用插件存储的 safeLoad 缓存最新配置，避免重复读取磁盘
- 令牌与地址校验：在 ShareApi 中提前校验服务端地址与令牌，避免无效请求带来的资源浪费
- 增量同步：对于大型 AppConfig，可考虑分块更新或按需更新，降低传输开销
- 文档树处理优化：ShareService通过docTreeHierarchy属性提供更精确的层次结构，减少不必要的遍历
- 引用文档递归控制：DEFAULT_SHARE_REFERENCES_MAX_DEPTH常量限制递归深度，防止性能问题

**更新** 新增了文档树处理优化和引用文档递归控制的性能考虑。

## 故障排查指南
- 无法连接分享服务
  - 现象：提示"未找到分享服务，请先初始化"
  - 排查：确认 ShareProConfig.serviceApiConfig.apiUrl 与 token 已正确填写；开发模式下检查是否被自动修正
  - 参考
    - [src/api/share-api.ts:178-183](file://src/api/share-api.ts#L178-L183)
    - [src/index.ts:150-169](file://src/index.ts#L150-L169)
- 保存设置失败
  - 现象：返回 code 非 1 或抛出异常
  - 排查：检查 SettingService.syncSetting 返回值；确认服务端接口可用与鉴权头正确
  - 参考
    - [src/utils/ShareConfigUtils.ts:74-80](file://src/utils/ShareConfigUtils.ts#L74-L80)
    - [src/api/share-api.ts:90-102](file://src/api/share-api.ts#L90-L102)
- 配置未生效
  - 现象：修改后页面未更新
  - 排查：确认 UI 层已监听配置变化并触发刷新；检查是否存在本地缓存未清理
  - 参考
    - [src/service/SettingService.ts:29-31](file://src/service/SettingService.ts#L29-L31)
    - [src/api/share-api.ts:79-88](file://src/api/share-api.ts#L79-L88)
- 文档树显示异常
  - 现象：文档树层级不正确或显示不完整
  - 排查：检查docTreeHierarchy属性是否正确传递；确认docTreeLevel设置合理
  - 参考
    - [src/service/ShareService.ts:1006-1014](file://src/service/ShareService.ts#L1006-L1014)
    - [src/i18n/zh_CN.json:78](file://src/i18n/zh_CN.json#L78)
    - [src/i18n/en_US.json:78](file://src/i18n/en_US.json#L78)

**更新** 新增了文档树显示异常的故障排查指南。

**章节来源**
- [src/api/share-api.ts:178-183](file://src/api/share-api.ts#L178-L183)
- [src/index.ts:150-169](file://src/index.ts#L150-L169)
- [src/utils/ShareConfigUtils.ts:74-80](file://src/utils/ShareConfigUtils.ts#L74-L80)
- [src/api/share-api.ts:90-102](file://src/api/share-api.ts#L90-L102)
- [src/service/SettingService.ts:29-31](file://src/service/SettingService.ts#L29-L31)
- [src/api/share-api.ts:79-88](file://src/api/share-api.ts#L79-L88)
- [src/service/ShareService.ts:1006-1014](file://src/service/ShareService.ts#L1006-L1014)
- [src/i18n/zh_CN.json:78](file://src/i18n/zh_CN.json#L78)
- [src/i18n/en_US.json:78](file://src/i18n/en_US.json#L78)

## 结论
SettingService 以轻量的职责边界实现了设置的云端同步与读取，配合 ShareApi 的鉴权与校验、index.ts 的安全加载与初始化、以及多模型（ShareProConfig/AppConfig/SingleDocSetting）的清晰分层，构建了完整的配置生命周期闭环。通过 SettingKeys 与 ShareConfigUtils 的配套，进一步保证了配置的一致性、可维护性与可扩展性。

**更新** 本次更新反映了最新的国际化改进和文档树层次结构处理能力增强，使设置服务能够更好地支持复杂的文档树展示需求。

## 附录

### 配置优先级规则（全局 vs 文档级）
- 全局配置（AppConfig）：影响整个站点的外观、域名、路径、密码保护、子/引用文档分享、增量分享等
- 文档级配置（SingleDocSetting）：覆盖全局配置中的部分字段，如文档树/大纲开关与层级、有效期、子/引用文档分享等
- 优先级原则
  - 文档级设置优先于全局设置；当文档级未设置时回退到全局设置
  - 未设置的字段保持默认值（DefaultAppConfig 或 SingleDocSetting 的默认值）

**章节来源**
- [src/models/AppConfig.ts:12-85](file://src/models/AppConfig.ts#L12-L85)
- [src/models/SingleDocSetting.ts:18-82](file://src/models/SingleDocSetting.ts#L18-L82)
- [src/utils/ShareConfigUtils.ts:16-42](file://src/utils/ShareConfigUtils.ts#L16-L42)

### 默认值处理与迁移策略
- 默认值
  - AppConfig 默认值：参考 DefaultAppConfig（语言、站点信息、主题、增量分享默认启用、子文档分享默认禁用等）
  - SingleDocSetting 默认值：未显式设置时采用全局默认行为
- 迁移策略
  - 首次加载：initCfg 将 inited 标记为 true 并写回存储，确保后续逻辑稳定
  - 开发模式：自动修正服务端地址，避免因环境切换导致的配置漂移
- 参考
  - [src/utils/ShareConfigUtils.ts:16-42](file://src/utils/ShareConfigUtils.ts#L16-L42)
  - [src/index.ts:150-169](file://src/index.ts#L150-L169)

### 配置热更新与实时生效检查
- 热更新机制
  - 云端设置更新后，可通过 SettingService.getSettingByAuthor 拉取最新配置
  - UI 层监听配置变化并触发局部刷新
- 实时生效检查
  - 保存设置后检查返回码与消息，必要时提示用户
  - 对于敏感配置（如密码保护、域名/路径），建议在保存后立即刷新页面或重新渲染相关组件
- 文档树热更新
  - docTreeHierarchy属性支持实时生效，无需重新分享即可更新文档树层次结构
  - 参考
    - [src/service/ShareService.ts:1006-1014](file://src/service/ShareService.ts#L1006-L1014)

**更新** 新增了文档树热更新的相关说明。

**章节来源**
- [src/service/SettingService.ts:33-35](file://src/service/SettingService.ts#L33-L35)
- [src/api/share-api.ts:90-102](file://src/api/share-api.ts#L90-L102)
- [src/service/ShareService.ts:1006-1014](file://src/service/ShareService.ts#L1006-L1014)

### 配置备份与恢复
- 备份
  - 通过插件存储的 safeLoad 获取当前 ShareProConfig，导出为 JSON 文件
- 恢复
  - 在新环境中使用 safeLoad 读取备份文件并写回存储
- 注意事项
  - 恢复前确认服务端地址与令牌一致；必要时在开发模式下修正
- 参考
  - [src/index.ts:126-148](file://src/index.ts#L126-L148)
  - [src/index.ts:150-169](file://src/index.ts#L150-L169)

### 配置与 UI 组件的绑定与双向同步
- 绑定关系
  - ShareSetting UI 组件接收插件实例与 VIP 信息，内部根据 AppConfig/SingleDocSetting 渲染表单
  - SettingKeys 作为键名约定，确保 UI 表单项与文档属性一致
  - 国际化文件提供清晰的用户指导，特别是文档树相关配置
- 双向同步
  - 用户在 UI 修改配置 → SettingService.syncSetting → ShareApi.saveSetting → 云端持久化
  - 云端配置变更 → SettingService.getSettingByAuthor → UI 刷新
- 文档树配置绑定
  - docTreeHierarchy属性与UI组件绑定，提供精确的文档树层次结构控制
  - 参考
    - [src/i18n/zh_CN.json:78](file://src/i18n/zh_CN.json#L78)
    - [src/i18n/en_US.json:78](file://src/i18n/en_US.json#L78)

**更新** 新增了文档树配置绑定的相关说明。

**章节来源**
- [src/index.ts:73-95](file://src/index.ts#L73-L95)
- [src/utils/SettingKeys.ts:13-72](file://src/utils/SettingKeys.ts#L13-L72)
- [src/service/SettingService.ts:29-35](file://src/service/SettingService.ts#L29-L35)
- [src/i18n/zh_CN.json:78](file://src/i18n/zh_CN.json#L78)
- [src/i18n/en_US.json:78](file://src/i18n/en_US.json#L78)

### 配置示例与最佳实践
- 自定义分享行为
  - 全局：在 AppConfig 中设置 domains、domain、basePaths、docPath 控制分享范围
  - 文档级：在 SingleDocSetting 中设置 docTreeEnable/docTreeLevel/outlineEnable/outlineLevel 控制展示细节
- SEO 优化设置
  - 在 AppConfig 中设置 siteTitle、siteSlogan、siteDescription、shareTemplate 等字段提升分享卡片质量
- 权限控制配置
  - 在 AppConfig 中启用 passwordEnabled/showPassword；在文档级设置 expiresTime 控制有效期
- 文档树配置最佳实践
  - 使用docTreeHierarchy属性提供精确的文档树层次结构
  - 合理设置docTreeLevel，避免过深的层级影响用户体验
  - 结合DEFAULT_SHARE_REFERENCES_MAX_DEPTH常量控制引用文档递归深度
  - 参考
    - [src/service/ShareService.ts:1006-1014](file://src/service/ShareService.ts#L1006-L1014)
    - [src/Constants.ts:29](file://src/Constants.ts#L29)
- 国际化配置
  - 利用更新后的国际化文件，提供更清晰的用户指导
  - 特别关注文档树相关的提示文本，确保用户理解配置含义
  - 参考
    - [src/i18n/zh_CN.json:78](file://src/i18n/zh_CN.json#L78)
    - [src/i18n/en_US.json:78](file://src/i18n/en_US.json#L78)

**更新** 新增了文档树配置最佳实践和国际化配置的相关内容。

**章节来源**
- [src/models/AppConfig.ts:12-85](file://src/models/AppConfig.ts#L12-L85)
- [src/models/SingleDocSetting.ts:18-82](file://src/models/SingleDocSetting.ts#L18-L82)
- [src/utils/SettingKeys.ts:13-72](file://src/utils/SettingKeys.ts#L13-L72)
- [src/index.ts:73-95](file://src/index.ts#L73-L95)
- [src/service/ShareService.ts:1006-1014](file://src/service/ShareService.ts#L1006-L1014)
- [src/Constants.ts:29](file://src/Constants.ts#L29)
- [src/i18n/zh_CN.json:78](file://src/i18n/zh_CN.json#L78)
- [src/i18n/en_US.json:78](file://src/i18n/en_US.json#L78)