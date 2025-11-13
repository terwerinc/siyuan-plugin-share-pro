### Change ID

add-subdocument-sharing

### 待办

- [ ] 在SettingKeys.ts中添加CUSTOM_SHARE_SUBDOCUMENTS配置键
- [ ] 在ShareOptions.ts中增加shareSubdocuments属性
- [ ] 在ShareProConfig.ts中添加全局shareSubdocuments配置
- [ ] 在SingleDocSetting.ts中增加shareSubdocuments属性
- [ ] 在SettingService.ts中实现配置的同步和管理方法
- [ ] 在ShareService.ts中实现子文档的递归获取和分享逻辑
- [ ] 更新ShareResult接口，添加子文档分享结果字段
- [ ] 在UI中添加子文档分享选项，确保新UI和旧UI都兼容

### 验收标准

1. 用户可以在全局设置中配置是否默认分享子文档
2. 用户可以在单次分享时单独控制是否分享子文档
3. 启用子文档分享时，系统应自动分享该文档下的所有层级子文档
4. 分享后的子文档应能够通过分享链接正常访问
5. 功能应在新UI和旧UI中都能正常使用
6. 对于拥有大量子文档的情况，分享操作应具有良好的性能