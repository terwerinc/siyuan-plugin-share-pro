# Change: DataViews 特殊资源处理

## Why
在当前的分享功能中，DataViews 组件的数据处理存在局限性，未能处理其中引用的特殊资源（如图片、附件等），导致相关资源无法正确显示。

## What Changes
- 服务端解析 DataViews 数据结构，提取其中包含的特殊资源（如图像）
- 服务端在返回数据中添加 `dataViewMedia` 字段，用于存储 DataViews 中的媒体资源
- 客户端实现轻量级的 `uploadDataViewMedia` 方法，该方法主要调用服务端接口
- 确保分享的 DataViews 内容在客户端正确渲染所有资源

## Impact
- 影响的规范：share-service
- 影响的代码：`src/service/ShareService.ts`、`src/composables/useDataTable.ts`