## MODIFIED Requirements

### Requirement: ShareService createShare 方法
ShareService 的 createShare 方法 SHALL 支持分享文档时同时分享引用的文档。

#### Scenario: 分享包含引用文档的内容
- **WHEN** 分享文档且 shareReferencedDocs 为 true 时
- **THEN** 系统 SHALL 提取文档中的引用（基于思源笔记的DOM格式）
- **THEN** 系统 SHALL 递归分享所有引用文档（最大深度限制）
- **THEN** 系统 SHALL 自动检测并跳过循环引用
- **THEN** 系统 SHALL 自动排除黑名单中的引用文档

## ADDED Requirements

### Requirement: ShareOptions 类扩展
ShareOptions 类 SHALL 添加 shareReferencedDocs 字段，用于控制是否分享引用文档。

#### Scenario: 设置分享引用文档选项
- **WHEN** 创建 ShareOptions 实例时
- **THEN** 系统 SHALL 接受 shareReferencedDocs 参数
- **THEN** shareReferencedDocs 默认为 false，保持向后兼容

### Requirement: SettingKeys 扩展
SettingKeys 枚举 SHALL 添加 CUSTOM_SHARE_REFERENCED_DOCS 配置键。

#### Scenario: 存储引用文档分享配置
- **WHEN** 需要存储全局引用文档分享设置时
- **THEN** 系统 SHALL 使用 CUSTOM_SHARE_REFERENCED_DOCS 配置键

### Requirement: ShareProConfig 扩展
ShareProConfig 类 SHALL 添加 shareReferencedDocs 字段，用于存储全局引用文档分享设置。

#### Scenario: 全局控制引用文档分享行为
- **WHEN** 读取全局配置时
- **THEN** 系统 SHALL 包含 shareReferencedDocs 配置项
- **THEN** shareReferencedDocs 默认为 false，保持向后兼容

### Requirement: SettingService 方法更新
SettingService 的 syncSetting 和 getSettingByAuthor 方法 SHALL 支持处理引用文档分享配置。

#### Scenario: 同步引用文档分享设置
- **WHEN** 同步设置时包含 CUSTOM_SHARE_REFERENCED_DOCS 配置
- **THEN** 系统 SHALL 更新 appConfig 中的 shareReferencedDocs 字段

#### Scenario: 获取引用文档分享设置
- **WHEN** 调用 getSettingByAuthor 方法时
- **THEN** 系统 SHALL 返回包含 CUSTOM_SHARE_REFERENCED_DOCS 的设置对象

### Requirement: SingleDocSetting 类扩展
SingleDocSetting 类 SHALL 添加 shareReferencedDocs 字段，用于存储单文档引用文档分享设置。

#### Scenario: 单文档引用文档分享设置
- **WHEN** 创建 SingleDocSetting 实例时
- **THEN** 系统 SHALL 接受 shareReferencedDocs 参数
- **THEN** shareReferencedDocs 默认为 false，保持向后兼容

### Requirement: UI 界面更新
分享设置界面和分享对话框 SHALL 添加「同时分享引用文档」的开关选项。

#### Scenario: 在全局设置中配置引用文档分享
- **WHEN** 用户访问全局设置界面时
- **THEN** 系统 SHALL 显示「分享引用文档」开关
- **THEN** 开关状态与全局配置保持一致

#### Scenario: 在单次分享中配置引用文档分享
- **WHEN** 用户打开分享对话框时
- **THEN** 系统 SHALL 显示「同时分享引用文档」开关
- **THEN** 开关默认状态与全局配置一致
- **THEN** 用户可以在单次分享时覆盖全局设置

#### Scenario: 在新UI模式下配置引用文档分享
- **WHEN** 用户启用了新UI模式并访问分享设置时
- **THEN** 系统 SHALL 在个性化设置区域显示引用文档分享选项
- **THEN** 设置会保存在新UI模式的配置中

### Requirement: 引用深度和循环检测
系统 SHALL 实现引用深度限制和循环引用检测机制。

#### Scenario: 引用深度限制
- **WHEN** 系统递归分享引用文档时
- **THEN** 默认最大递归深度 SHALL 为3层
- **THEN** 用户 SHALL 能够在设置中调整深度（1-5层）
- **THEN** 超过深度限制的引用 SHALL 不再继续分享并记录日志
- **THEN** 在分享前预览中 SHALL 显示被截断的引用

#### Scenario: 循环引用检测
- **WHEN** 系统检测引用关系时
- **THEN** 系统 SHALL 维护已处理文档ID列表（HashSet）
- **THEN** 检测到循环引用时 SHALL 跳过并记录警告日志
- **THEN** 在结果报告中 SHALL 显示循环引用的文档
- **THEN** 系统 SHALL 提供循环引用关系图可视化展示

### Requirement: 引用关系可视化
系统 SHALL 提供引用关系的可视化展示和选择性分享功能。

#### Scenario: 分享前预览
- **WHEN** 用户分享开启了引用文档分享的文档时
- **THEN** 系统 SHALL 展示引用关系树结构
- **THEN** 系统 SHALL 显示将要分享的文档总数和层级关系
- **THEN** 用户 SHALL 能够手动排除特定引用文档
- **THEN** 树形图 SHALL 支持展开/折叠操作

#### Scenario: 精细化引用控制
- **WHEN** 用户需要精确控制引用分享时
- **THEN** 系统 SHALL 区分文档引用和块引用
- **THEN** 系统 SHALL 支持分别配置是否分享
- **THEN** 系统 SHALL 显示所有引用文档列表（按层级分组）
- **THEN** 用户 SHALL 能够手动勾选要分享的引用
- **THEN** 系统 SHALL 记住用户的选择偏好

#### Scenario: 智能排除规则
- **WHEN** 系统处理引用文档时
- **THEN** 系统 SHALL 自动排除黑名单中的引用文档
- **THEN** 系统 SHALL 自动排除其他笔记本的引用（可配置）
- **THEN** 系统 SHALL 支持自定义排除规则（正则表达式）

### Requirement: 性能与体验优化
系统 SHALL 实现性能优化和用户体验提升。

#### Scenario: 分享前预估
- **WHEN** 用户准备分享包含引用的文档时
- **THEN** 系统 SHALL 计算引用文档总数和层级深度
- **THEN** 系统 SHALL 预估分享所需时间（每个文档约3秒）
- **THEN** 系统 SHALL 显示存储空间占用预估
- **THEN** 系统 SHALL 询问用户确认后开始分享

#### Scenario: 进度反馈
- **WHEN** 执行引用文档分享时
- **THEN** 系统 SHALL 实时显示分享进度（X/Y）和百分比
- **THEN** 系统 SHALL 显示当前正在处理的文档名称和层级
- **THEN** 系统 SHALL 显示预估剩余时间
- **THEN** 系统 SHALL 支持取消分享操作

#### Scenario: 性能限制
- **WHEN** 引用文档数量超过50个时
- **THEN** 系统 SHALL 提示用户分批分享
- **THEN** 系统 SHALL 提供“仅分享首层引用”快捷选项

### Requirement: DOM解析实现
系统 SHALL 实现基于思源笔记DOM格式的引用提取。

#### Scenario: 引用识别
- **WHEN** 系统解析文档内容时
- **THEN** 系统 SHALL 使用正则表达式：`/\(\((\d{14}-[a-z0-9]{7})\)\)/g`
- **THEN** 系统 SHALL 区分文档ID（20位）和块ID（21位）
- **THEN** 系统 SHALL 支持嵌套的块引用解析

#### Scenario: 兼容性处理
- **WHEN** 提取引用关系时
- **THEN** 系统 SHALL 优先使用思源API获取引用关系（SQL查询）
- **THEN** DOM解析 SHALL 作为备用方案
- **THEN** 系统 SHALL 记录不兼容的情况并上报日志

### Requirement: 功能交互设计
系统 SHALL 实现与其他分享功能的协同。

#### Scenario: 与增量分享协同
- **WHEN** 增量分享时开启了引用文档分享
- **THEN** 引用文档分享设置 SHALL 自动继承
- **THEN** 增量检测 SHALL 包含所有引用的文档
- **THEN** 黑名单过滤优先级 SHALL 最高
- **THEN** 引用深度限制 SHALL 在增量分享中同样生效

#### Scenario: 与子文档分享协同
- **WHEN** 同时开启子文档和引用文档分享时
- **THEN** 系统 SHALL 先处理子文档，再处理引用
- **THEN** 系统 SHALL 去重处理，避免同一文档多次分享
- **THEN** 在预览中 SHALL 明确标记文档来源

### Requirement: 移动端适配
系统 SHALL 提供移动端友好的体验。

#### Scenario: 移动端界面适配
- **WHEN** 用户在移动端访问引用关系树时
- **THEN** 系统 SHALL 以简化列表显示
- **THEN** 系统 SHALL 支持触摸展开/折叠节点
- **THEN** 预览页面 SHALL 占据全屏

### Requirement: 异常场景处理
系统 SHALL 实现完善的异常处理。

#### Scenario: 引用文档异常
- **WHEN** 引用文档已删除时
- **THEN** 系统 SHALL 跳过并记录日志，提示用户
- **WHEN** 引用文档权限不足时
- **THEN** 系统 SHALL 显示明确的错误信息
- **WHEN** 循环引用检测失败时
- **THEN** 系统 SHALL 设置最大迭代次数防御
- **WHEN** 引用解析失败时
- **THEN** 系统 SHALL 降级处理，仅分享当前文档

### Requirement: 智能重试机制
系统 SHALL 实现引用文档分享的智能重试机制。

#### Scenario: 网络错误重试
- **WHEN** 分享引用文档时遇到网络错误
- **THEN** 系统 SHALL 自动重试3次
- **THEN** 系统 SHALL 使用指数退避策略（1s, 2s, 4s）

#### Scenario: 服务端错误重试
- **WHEN** 遇到5xx服务端错误时
- **THEN** 系统 SHALL 延迟30秒后重试一次
- **THEN** 失败时 SHALL 记录详细日志

#### Scenario: 批量分享队列
- **WHEN** 批量分享引用文档时
- **THEN** 系统 SHALL 支持暂停/继续操作
- **THEN** 系统 SHALL 支持仅重试失败项
- **THEN** 系统 SHALL 保存进度到本地存储

### Requirement: 数据一致性
系统 SHALL 确保引用文档分享的数据一致性。

#### Scenario: 引用关系验证
- **WHEN** 系统分享引用文档时
- **THEN** 系统 SHALL 在分享前验证引用关系的有效性
- **THEN** 系统 SHALL 检测引用文档是否存在
- **THEN** 无效引用 SHALL 被标记并跳过

#### Scenario: 并发控制
- **WHEN** 并发分享多个引用文档时
- **THEN** 系统 SHALL 限制最多3个并发请求
- **THEN** 系统 SHALL 使用队列管理待处理的引用

### Requirement: 国际化支持
系统 SHALL 提供完整的国际化支持。

#### Scenario: 文案翻译
- **WHEN** 系统显示引用文档相关文案时
- **THEN** 所有文案 SHALL 使用 referencedDocs.xxx 命名空间
- **THEN** 系统 SHALL 支持中文和英文
- **THEN** 关键文案 SHALL 包括：enable、depth、preview、circular、excluded、retrying、queue、estimate、treeView

### Requirement: 数据统计与分析
系统 SHALL 提供引用文档分享的统计与分析功能。

#### Scenario: 引用统计
- **WHEN** 用户查看分享历史时
- **THEN** 系统 SHALL 显示引用文档分享统计
- **THEN** 统计 SHALL 包括：总引用数、层级分布、循环引用次数
- **THEN** 系统 SHALL 展示引用深度趋势图

#### Scenario: 常见引用分析
- **WHEN** 用户查看统计信息时
- **THEN** 系统 SHALL 显示最常被引用的文档Top 10
- **THEN** 系统 SHALL 分析引用关系密集度
- **THEN** 系统 SHALL 提供引用关系优化建议