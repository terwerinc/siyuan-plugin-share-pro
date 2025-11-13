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