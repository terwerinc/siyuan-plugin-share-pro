# Change: 分享引用文档功能

## Why
当前插件只支持分享单个文档，当文档中引用了其他文档时，这些引用的文档无法被访问，导致分享内容不完整。需要实现分享文档时同时分享其引用的文档，并提供全局和新UI模式下的个性化开关。

## What Changes
- 在 ShareService 中实现引用文档的递归分享逻辑（引用文档提取方法将根据思源笔记的DOM格式进行专门实现）
- 扩展 ShareOptions 类，支持 shareReferencedDocs 配置项
- 在 SettingKeys 中添加 CUSTOM_SHARE_REFERENCED_DOCS 配置键
- 在 ShareProConfig 中添加 shareReferencedDocs 全局配置
- 在 UI 组件中添加对应的开关选项

## Impact
- 影响的规范：share
- 影响的代码：`src/service/ShareService.ts`、`src/models/ShareOptions.ts`、`src/utils/SettingKeys.ts`、`src/models/ShareProConfig.ts`、UI 组件