## MODIFIED Requirements

### Requirement: ShareService createShare 方法
ShareService 的 createShare 方法 SHALL 支持分享文档时同时分享引用的文档。

#### Scenario: 分享包含引用文档的内容
- **WHEN** 分享文档且 shareReferencedDocs 为 true 时
- **THEN** 系统 SHALL 提取文档中的引用（基于思源笔记的DOM格式）
- **THEN** 系统 SHALL 递归分享所有引用文档

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