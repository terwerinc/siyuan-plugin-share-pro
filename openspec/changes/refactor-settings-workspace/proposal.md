# Change: 重构设置工作区与保存主干

## Why
当前设置页的一级 tab 已经逐步膨胀，多个 tab 继续沿用“独立页面 + 独立保存按钮 + 独立加载逻辑”的模式，在较小屏幕上会同时出现导航拥挤、内容过长、保存语义分散的问题。继续按现状新增配置，会让布局和保存逻辑都越来越难维护。

## What Changes
- 重构设置页为统一的设置工作区，控制一级导航数量并支持小屏响应式切换
- 将基础表单类设置改为统一草稿模型与统一保存出口
- 将现有配置重新编组为更稳定的高层分区，减少后续新增配置对导航结构的冲击
- 保留黑名单等即时操作型功能的独立持久化语义，不并入统一草稿保存
- 为设置工作区补充保存链路与交互状态的测试

## Impact
- Affected specs: `settings-ui`
- Affected code:
  - `src/libs/pages/ShareSetting.svelte`
  - `src/libs/components/tab/Tab.svelte`
  - `src/libs/pages/setting/*.svelte`
  - `src/service/SettingService.ts`
  - `src/utils/ShareConfigUtils.ts`
  - related i18n files and tests
