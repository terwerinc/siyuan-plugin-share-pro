## MODIFIED Requirements

### Requirement: ShareService createShare 方法
ShareService 的 createShare 方法 SHALL 支持分享文档时同时分享该文档下的所有子文档。

#### Scenario: 分享包含子文档的文档树
- **WHEN** 分享文档且 shareSubdocuments 为 true 时
- **THEN** 系统 SHALL 递归获取该文档下的所有子文档
- **THEN** 系统 SHALL 自动分享所有层级的子文档，形成完整的文档树结构

## ADDED Requirements

### Requirement: ShareOptions 类扩展
ShareOptions 类 SHALL 添加 shareSubdocuments 属性，用于控制是否分享子文档。

#### Scenario: 设置分享子文档选项
- **WHEN** 创建 ShareOptions 实例时
- **THEN** 系统 SHALL 接受 shareSubdocuments 参数
- **THEN** shareSubdocuments 默认为 false，保持向后兼容

### Requirement: SettingKeys 扩展
SettingKeys 枚举 SHALL 添加 CUSTOM_SHARE_SUBDOCUMENTS 配置键。

#### Scenario: 存储子文档分享配置
- **WHEN** 需要存储全局子文档分享设置时
- **THEN** 系统 SHALL 使用 CUSTOM_SHARE_SUBDOCUMENTS 配置键

### Requirement: ShareProConfig 扩展
ShareProConfig 类 SHALL 添加 shareSubdocuments 字段，用于存储全局子文档分享设置。

#### Scenario: 全局控制子文档分享行为
- **WHEN** 读取全局配置时
- **THEN** 系统 SHALL 包含 shareSubdocuments 配置项
- **THEN** shareSubdocuments 默认为 false，保持向后兼容

### Requirement: SettingService 方法更新
SettingService SHALL 添加对子文档分享配置的支持，包括全局配置和单文档配置的管理方法。

#### Scenario: 同步子文档分享设置
- **WHEN** 同步设置时包含 CUSTOM_SHARE_SUBDOCUMENTS 配置
- **THEN** 系统 SHALL 更新 appConfig 中的 shareSubdocuments 字段

#### Scenario: 获取有效的子文档分享设置
- **WHEN** 调用 getEffectiveShareSubdocumentsSetting 方法时
- **THEN** 系统 SHALL 优先返回单文档设置，若无则返回全局设置

### Requirement: SingleDocSetting 类扩展
SingleDocSetting 类 SHALL 添加 shareSubdocuments 字段，用于存储单文档子文档分享设置。

#### Scenario: 单文档子文档分享设置
- **WHEN** 创建 SingleDocSetting 实例时
- **THEN** 系统 SHALL 接受 shareSubdocuments 参数
- **THEN** shareSubdocuments 默认为 undefined，表示使用全局设置

### Requirement: 子文档递归获取逻辑
系统 SHALL 实现子文档的递归获取逻辑，支持获取文档树中的所有层级子文档。

#### Scenario: 递归遍历文档树
- **WHEN** 调用 getSubdocumentIds 方法时
- **THEN** 系统 SHALL 递归获取指定文档的所有层级子文档
- **THEN** 返回的文档ID列表 SHALL 包含所有层级的子文档

### Requirement: UI 兼容性
分享设置界面和分享对话框 SHALL 添加「同时分享子文档」的开关选项，并确保在新UI和旧UI中都能正常使用。

#### Scenario: 在全局设置中配置子文档分享
- **WHEN** 用户访问全局设置界面时
- **THEN** 系统 SHALL 显示「分享子文档」开关
- **THEN** 开关状态与全局配置保持一致

#### Scenario: 在单次分享中配置子文档分享
- **WHEN** 用户打开分享对话框时
- **THEN** 系统 SHALL 显示「同时分享子文档」开关
- **THEN** 开关默认状态与全局配置一致
- **THEN** 用户可以在单次分享时覆盖全局设置

#### Scenario: 在新UI模式下配置子文档分享
- **WHEN** 用户启用了新UI模式并访问分享设置时
- **THEN** 系统 SHALL 在个性化设置区域显示子文档分享选项
- **THEN** 设置会保存在新UI模式的配置中

### Requirement: 子文档递归策略
系统 SHALL 实现子文档递归的深度控制和性能优化。

#### Scenario: 深度控制
- **WHEN** 用户分享子文档时
- **THEN** 默认递归所有层级，但最多100个子文档
- **THEN** 超过100个时，系统 SHALL 提示用户并询问是否继续
- **THEN** 系统 SHALL 提供“仅分享N层子文档”选项（1-10层可选）
- **THEN** 系统 SHALL 显示当前文档的子文档总数和最大深度

#### Scenario: 性能优化
- **WHEN** 获取子文档列表时
- **THEN** 系统 SHALL 使用广度优先遍历（BFS）算法
- **THEN** 子文档信息 SHALL 缓存1分钟，避免重复查询
- **THEN** 系统 SHALL 支持异步加载子文档列表，不阻塞主线程
- **THEN** 分享时 SHALL 批量处理，每次最多10个并发请求

#### Scenario: 子文档树预览
- **WHEN** 用户开启子文档分享功能时
- **THEN** 系统 SHALL 展示子文档树结构
- **THEN** 系统 SHALL 显示将要分享的文档总数和层级关系
- **THEN** 用户 SHALL 能够手动排除特定子文档
- **THEN** 树形图 SHALL 支持展开/折叠操作

### Requirement: 进度反馈与体验优化
系统 SHALL 实现子文档分享的进度反馈和用户体验优化。

#### Scenario: 分享前预估
- **WHEN** 用户准备分享包含子文档的文档时
- **THEN** 系统 SHALL 计算子文档总数和层级深度
- **THEN** 系统 SHALL 预估分享所需时间（每个文档约3秒）
- **THEN** 系统 SHALL 显示存储空间占用预估
- **THEN** 系统 SHALL 询问用户确认后开始分享

#### Scenario: 进度显示
- **WHEN** 执行子文档分享时
- **THEN** 系统 SHALL 实时显示分享进度（X/Y）和百分比
- **THEN** 系统 SHALL 显示当前正在处理的文档名称和层级
- **THEN** 系统 SHALL 显示预估剩余时间
- **THEN** 系统 SHALL 支持取消分享操作

#### Scenario: 性能限制
- **WHEN** 子文档数量超过50个时
- **THEN** 系统 SHALL 提示用户分批分享
- **THEN** 系统 SHALL 提供“仅分享首层子文档”快捷选项

### Requirement: 功能交互设计
系统 SHALL 实现与其他分享功能的协同。

#### Scenario: 与增量分享协同
- **WHEN** 增量分享时开启了子文档分享
- **THEN** 子文档分享设置 SHALL 自动继承
- **THEN** 增量检测 SHALL 包含所有子文档
- **THEN** 黑名单过滤优先级 SHALL 最高
- **THEN** 子文档深度限制 SHALL 在增量分享中同样生效

#### Scenario: 与引用文档分享协同
- **WHEN** 同时开启子文档和引用文档分享时
- **THEN** 系统 SHALL 先处理子文档，再处理引用
- **THEN** 系统 SHALL 去重处理，避免同一文档多次分享
- **THEN** 在预览中 SHALL 明确标记文档来源（子文档/引用）

### Requirement: 智能重试机制
系统 SHALL 实现子文档分享的智能重试机制。

#### Scenario: 网络错误重试
- **WHEN** 分享子文档时遇到网络错误
- **THEN** 系统 SHALL 自动重试3次
- **THEN** 系统 SHALL 使用指数退避策略（1s, 2s, 4s）

#### Scenario: 服务端错误重试
- **WHEN** 遇到5xx服务端错误时
- **THEN** 系统 SHALL 延迟30秒后重试一次
- **THEN** 失败时 SHALL 记录详细日志

#### Scenario: 批量分享队列
- **WHEN** 批量分享子文档时
- **THEN** 系统 SHALL 支持暂停/继续操作
- **THEN** 系统 SHALL 支持仅重试失败项
- **THEN** 系统 SHALL 保存进度到本地存储

### Requirement: 移动端适配
系统 SHALL 提供移动端友好的体验。

#### Scenario: 移动端界面适配
- **WHEN** 用户在移动端访问子文档树时
- **THEN** 系统 SHALL 以简化列表显示
- **THEN** 系统 SHALL 支持触摸展开/折叠节点
- **THEN** 预览页面 SHALL 占据全屏

### Requirement: 异常场景处理
系统 SHALL 实现完善的异常处理。

#### Scenario: 子文档异常
- **WHEN** 子文档已删除时
- **THEN** 系统 SHALL 跳过并记录日志，提示用户
- **WHEN** 子文档权限不足时
- **THEN** 系统 SHALL 显示明确的错误信息
- **WHEN** 子文档查询失败时
- **THEN** 系统 SHALL 降级处理，仅分享当前文档

### Requirement: 国际化支持
系统 SHALL 提供完整的国际化支持。

#### Scenario: 文案翻译
- **WHEN** 系统显示子文档相关文案时
- **THEN** 所有文案 SHALL 使用 subdocuments.xxx 命名空间
- **THEN** 系统 SHALL 支持中文和英文
- **THEN** 关键文案 SHALL 包括：enable、depth、preview、treeView、estimate、queue、retrying

### Requirement: 数据统计与分析
系统 SHALL 提供子文档分享的统计与分析功能。

#### Scenario: 子文档统计
- **WHEN** 用户查看分享历史时
- **THEN** 系统 SHALL 显示子文档分享统计
- **THEN** 统计 SHALL 包括：总子文档数、层级分布、平均深度
- **THEN** 系统 SHALL 展示子文档深度趋势图

#### Scenario: 常见文档树分析
- **WHEN** 用户查看统计信息时
- **THEN** 系统 SHALL 显示最常分享的文档树Top 10
- **THEN** 系统 SHALL 分析文档树结构复杂度
- **THEN** 系统 SHALL 提供文档结构优化建议