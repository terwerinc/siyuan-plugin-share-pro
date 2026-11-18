# 元信息与属性

本页用于处理标签、摘要、memo、alias 和相关属性。

## 基本规则

- 写入属性统一走 `siyuan attr set`
- 先读现有属性（`siyuan attr get`），再写新值
- 沿用同类文档已有格式，不擅自发明新格式
- 不把导出 frontmatter 当作主写入接口

## `memo`

适用场景：

- 需要短摘要
- 需要增强检索
- 用户明确要求补摘要

写法要求：

- 简短
- 基于事实
- 不只是重复标题

```bash
siyuan attr set --id <docID> --attr "memo=<短摘要>" -w <ws>
```

## `tags`

适用场景：

- 需要统一主题聚类
- 需要后续检索
- 当前文档家族已有稳定标签约定

写法要求：

- 短
- 稳定
- 名词导向
- 跨笔记保持一致

常见例子：

- `周记`
- `工作`
- `学习`
- `项目`

```bash
siyuan attr set --id <docID> --attr "tags=周记,工作" -w <ws>
```

`tags` 为逗号分隔的多个标签名。

## `alias`

仅在以下情况使用：

- 当前文档族已经大量使用 alias
- 确有检索价值
- 用户明确要求

不要为每页都补 alias。

```bash
siyuan attr set --id <docID> --attr "alias=<别名>" -w <ws>
```

## 标签批量整理

CLI 可用的标签级命令：

- `siyuan tag list [--keyword <kw>]` — 标签清单
- `siyuan tag rename --old <old> --new <new>` — 重命名标签（全库生效）
- `siyuan tag remove --label <label>` — 删除标签

> ⚠️ **能力限制：** 没有“批量替换块内标签”的命令，只有标签级的重命名与删除。
> 需要此类操作时，先向用户说明限制，不要通过改 `siyuan.db` 蛮干绕过。

对 `tag rename` / `tag remove` 这类全库生效的命令：

- 先 `--dry-run`
- 先 `siyuan repo create --memo "<说明>"` 建快照
- 执行后把结果向用户汇报

## Daily Note 配置相关

如果任务涉及：

- daily note 路径
- daily note 模板
- 按笔记本配置决定落点

> ⚠️ **能力限制：** 当前 CLI **没有** 读取或写入笔记本配置的命令。
> `siyuan notebook` 只有 `list / create / rename / remove / open / close / set-icon / random-icon`。

因此：

- **不要自己硬编码 daily note 路径**
- **不要** 为了拿到配置去直接改 `conf.json` 或 `siyuan.db`
- 无法从真实上下文确认笔记本归属或日记落点时，先问用户

可用的替代路径：`siyuan dailynote append / create / prepend --notebook <nbID>` 由内核按配置自行落到正确位置。

## 其他常用属性

`siyuan attr set` 还支持（以 `--help` 为准）：

- `icon` — emoji 码点（`1f4ca`）、emoji 字符、自定义图片路径或网络图片 URL
- `title-img` — CSS `background-image` 格式，**不要** 直接写裸资源路径

```bash
siyuan attr set --id <docID> --attr icon=1f4ca -w <ws>
siyuan attr set --id <docID> --attr 'title-img=background-image:url("assets/example.jpg")' -w <ws>
```

## frontmatter 边界

读取文档时可能看到：

```yaml
---
title:
date:
lastmod:
---
```

这属于导出视图（`siyuan export md`）的表现层。
它不等于“以后应直接写 frontmatter 维护元数据”。

默认做法：

- 读取时接受它存在
- 写入时优先用思源原生属性命令 `siyuan attr set`
