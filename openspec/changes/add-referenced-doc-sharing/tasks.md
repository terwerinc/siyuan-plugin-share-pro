# 分享引用文档功能 - 任务列表

## Change ID

`add-referenced-doc-sharing`

## 任务状态

### 待办
- [ ] 扩展 SettingKeys 枚举，添加 CUSTOM_SHARE_REFERENCED_DOCS 配置键
- [ ] 扩展 ShareOptions 类，添加 shareReferencedDocs 字段
- [ ] 更新 ShareProConfig 类，添加 shareReferencedDocs 全局配置
- [ ] 扩展 SingleDocSetting 类，添加 shareReferencedDocs 字段
- [ ] 更新 SettingService 方法，支持引用文档分享配置
- [ ] 修改 ShareService，添加提取引用和递归分享功能
- [ ] 更新 UI 组件，添加引用文档分享开关

### 进行中

### 已完成

## 验收标准

1. 用户可以在全局设置中配置是否默认分享引用文档
2. 用户可以在单次分享时覆盖全局设置
3. 开启引用文档分享后，所有被引用的文档会被自动分享
4. 系统会根据思源笔记的DOM格式正确提取并分享所有被引用的文档
5. 在新UI模式下，个性化设置中包含引用文档分享选项
6. 现有功能不受影响，保持向后兼容