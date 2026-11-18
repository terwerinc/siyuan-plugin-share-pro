# 操作流程

本页定义 llm-wiki 在 SiYuan 中的默认执行流（CLI 版）。

> 所有命令都需带 `-w <workspace>`；需要机器解析时加 `-f json`。
> 写操作前先 `--dry-run` 演练；写操作前后遵守 `SKILL.md` 的 **pull → 操作 → push** 铁律。

## 0. Locate：所有任务先定位

先做定位，再决定编辑动作。

推荐顺序：

1. `siyuan search "<关键词>"`：先找主题候选块 / 候选页
2. `siyuan search "<关键词>" -t document`：只看文档块，收窄到“页”级别
3. `siyuan search "<关键词>" -n <nbID> --path <前缀> -s 20 -p 1`：限定笔记本、路径前缀并分页
4. `siyuan document search "<标题关键词>"`：按标题找文档
5. `siyuan document list --notebook <nbID> [--path /] [--hpath "..."]`：确认层级归属与父子关系
6. `siyuan sql "select id,box,hpath,updated from blocks where type='d' order by updated desc limit 20"`：判断最近活跃页

定位阶段规则：

- 搜索摘要不够时，必须读取全文后再改
- 候选页多于一个且无法自动裁决时，先确认
- 先判断目标页是容器页、来源页、知识页还是周期页

## 1. Quick Capture：快速记录、待办与 Daily Note

适用：

- 用户说“记一下”“快速记录”“备忘”
- 用户说“TODO”“待办”“提醒我”
- 用户要求“整理今天”“整理今日笔记”
- 用户要求“产出本周周报”

### 快速记录

默认流程：

1. 判断内容是否只是来源记录，还是应该并入已有知识页
2. 只是今日记录时，优先 `siyuan dailynote append --notebook <nbID> --data <md>`
3. 需要沉淀到项目页 / 主题页时，转入 Ingest 流程
4. 内容使用纯 Markdown；需要时间戳时只使用用户给出的时间或当前真实时间
   （当前时间可用 `siyuan system current-time -w <ws> -f json`）

规则：

- 不硬编码 Daily Note 路径或 notebook_id
- notebook_id 无法从真实上下文确认时，先问用户
- 不为了快速记录而新建重复主题页

### 新增待办

默认流程：

1. 将待办整理为 Markdown checkbox
2. 未完成写作 `- [ ]`，已完成写作 `- [x]`
3. 今日待办优先 `siyuan dailynote append --notebook <nbID> --data "- [ ] ..."`
4. 如果用户明确指定项目页、周页或承接页，则先定位并读取该页，再按最小影响面追加
   （`siyuan block append --parent <docID> --data <md>`）

规则：

- 不擅自判断待办已完成
- 不把“提醒我”类输入改写成抽象总结

### 列出未完成待办

> ⚠️ **CLI 无专用命令：** `dailynote` 只有 `append / create / prepend`，没有列出待办的子命令。

替代做法（均为只读，可执行）：

1. 定位今日日记文档 ID（`siyuan sql` 查当日文档，或由用户 / 上下文给出）
2. 读取全文：`siyuan block kramdown --id <docID>`
3. 用 `siyuan sql` 查 checkbox 块，例如：
   ```sql
   select id, content from blocks where type='i' and subtype='u' and markdown like '%[ ]%' limit 100
   ```
   （SQL 结构需按真实库字段确认后再依赖）

规则：

- 范围（days）按用户要求；用户未说明时先确认范围
- 只汇总真实读取到的 TODO，不补写不存在的待办
- 不确定 daily note 落点归属时先问用户，不要硬编码路径

### 整理今天

默认流程：

1. 定位今日 Daily Note 或用户指定的今日来源页
2. 读取今日内容：`siyuan block kramdown --id <docID>`
3. 汇总今日未完成 TODO（见上一节）
4. 追加整理段落：`siyuan block append --parent <docID> --data <md>`
5. 将“可归档”内容先列为候选，不自动搬移

规则：

- 不静默改写原始时间线
- 不自动删除或迁移归档候选
- 需要整页改写时，必须先读完整目标文档并确认不是误写容器页

### 产出周报

默认流程：

1. 定位本周来源页、周记页或相关知识页
2. 读取必要内容与未完成 TODO
3. 先产出纯 Markdown 周报草稿
4. 只有用户明确要求写回时，才创建或更新思源文档

规则：

- 周报草稿不等于周记归档
- 写回位置不明确时先确认
- 不补写无法确认的完成事项

## 2. Ingest：把新来源整合进现有体系

适用：

- 用户给出一段新内容
- 会议纪要补录
- 周记补充
- 调研内容入库
- 新事实并入已有主题

默认流程：

1. Locate 候选页
2. 判断该内容更适合：
   - 追加到来源页
   - 更新知识页
   - 新建来源页
3. 读取目标文档：`siyuan block kramdown --id <docID>`
4. 选择最小修改工具：
   - 追加尾部：`siyuan block append --parent <docID> --data <md>`
   - 头部插入：`siyuan block prepend --parent <docID> --data <md>`
   - 指定兄弟位置插入：`siyuan block insert --parent <parentID> --previous <siblingID> --data <md>`
   - 修改单个块：`siyuan block update --id <blockID> --data <md>`
   - 新建文档：`siyuan document create --notebook <nbID> --title "<title>" [--markdown <md>]`
   - 今日记录：`siyuan dailynote append --notebook <nbID> --data <md>`
5. 必要时补属性：`siyuan attr set --id <id> --attr memo=... --attr tags=...`

> **整页覆盖注意：** CLI 没有 `document update`。文档块能否用
> `siyuan block update --id <docID>` 整页覆盖 **尚未实测确认，** 不要直接假设。
> 优先选择“追加 / 局部块修改”，确需整页重写时先 `--dry-run` 实测或与用户确认方案。

规则：

- 默认优先更新已有知识页
- 不默认一次改很多页
- 只有用户明确要求“同步维护多个页面”时，才扩展为多文档更新

## 3. Maintain：维护知识页或结构

适用：

- 项目页更新
- 主题页整合
- 汇总页整理
- 路径归位
- 标签统一
- 周记归档

默认流程：

1. Locate 目标页
2. 读取全文
3. 判断维护方式：
   - 文档尾部追加
   - 局部块级精修
   - 改名 / 移动 / 标签整理
   - 整页重写（需先确认，见上文覆盖注意）
4. 执行最小必要修改

优先命令：

- `siyuan block append --parent <docID>`
- `siyuan block insert --parent <parentID> --previous <siblingID>`
- `siyuan block update --id <blockID>`
- `siyuan document rename --id <docID> --title "<title>"`
- `siyuan document move --id <docID> --notebook <nbID> [--path|--hpath]`
- `siyuan attr set --id <id> --attr ...`
- `siyuan tag rename --old <old> --new <new>`

块级只在以下情况使用：

- 需要精确放到最前面：`siyuan block prepend`
- 需要局部结构移动：`siyuan block move`
- 需要理解局部结构：`siyuan block children`
- 需要块级位置上下文：`siyuan block breadcrumb`、`siyuan block get`

> **标签批量替换注意：** CLI 只有 `tag rename`（重命名标签）与 `tag remove`（删除标签），
> **没有** “批量替换块内标签”的命令。需要这类操作时先向用户说明能力限制。

## 4. Query：基于思源知识层回答

适用：

- 总结
- 比较
- 归纳
- 从已有笔记提炼结论

默认流程：

1. Locate 相关知识页 / 来源页
2. 读取全文
3. 需要局部证据时，再读子块或 breadcrumb
4. 输出回答
5. **只有用户明确要求时，** 再回写结果

规则：

- 不自动把每次回答都写回思源
- 不自动新建“分析页”
- 用户只要答案时，先回答，不做额外写入

## 5. Lint：健康检查

适用：

- 用户要求检查知识库质量
- 整理重复页
- 查找过时页
- 检查标签使用

推荐命令：

- `siyuan search "<主题>"`
- `siyuan tag list`
- `siyuan sql "..."`（重复标题、孤儿页、引用分布）
- `siyuan sql "select id,box,hpath,updated from blocks where type='d' order by updated asc limit 50"`（久未更新）
- `siyuan ref backlinks --id <blockID>`（入链情况）

可检查内容：

- 重复主题页
- 明显过时页
- 路径归属异常
- 标签混乱
- 应沉淀未沉淀的内容

规则：

- 默认先输出发现，再执行大改
- 批量危险修改前先 `siyuan repo create --memo "<说明>"`

## 搜索策略

### 模糊主题 / 自然语言

- `siyuan search "<自然语言>"`（`-m 0` 关键词）
- 配了 embedding 时可用 `-m 4` 语义

### 精确收窄

- `-t / --type` 按块类型（含 `document`）
- `--subtype` 按块子类型（`h1`-`h6`、`list:o` 等）
- `-n / --notebook` 按笔记本
- `--path` 按路径前缀

### 大库深查

- 分页 `-s / -p`
- `-o` 排序（`4` = updated-desc）
- `-g 1` 按文档分组
- 需要 tag 维度筛选时改用 `siyuan sql`

## 写入策略

### 优先顺序

1. 追加比整页覆盖更优先
2. 文档级写入比复杂块链路更优先
3. 已有文档比新文档更优先

### 覆盖式写入前必须做到

- 先读完整目标文档（`siyuan block kramdown --id <docID>`）
- 保留现有有效结构与内部链接
- 确认目标页不是容器页误写
- 先 `--dry-run`

## 需要先确认的情况

- 候选目标页不唯一
- 已完成 / 未完成界线不清
- 删除、覆盖、迁移范围不清
- 下一周页或承接页目标不清
- 要不要把回答结果回写，不明确
- 涉及 CLI 缺失能力（笔记本配置、待办列举、整页覆盖等）
