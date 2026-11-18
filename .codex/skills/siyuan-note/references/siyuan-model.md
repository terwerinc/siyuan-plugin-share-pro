# SiYuan 对象模型

本页解释 llm-wiki 范式在 SiYuan 中如何落地，以及 CLI 下各对象的操作入口。

## 三层模型

### 1. 来源层

包括：

- 用户当前输入
- 当前周记
- 每日记录
- 单次会议纪要
- 单次调研摘录

规则：

- 这些内容承载事实来源
- 可以整理、归档、追加
- 但不要静默改写原始事实含义

### 2. 知识层

包括：

- 项目页
- 主题页
- 汇总页
- 长期维护页
- 周记归档页
- 承接页

规则：

- 这些是 llm-wiki 的主要维护对象
- 回答问题优先读这些页
- 新事实通常应整合到这些页，而不是只停留在聊天中

### 3. Schema 层

包括：

- `SKILL.md`
- references 中的规则文件

规则：

- schema 约束 LLM 如何定位、读取、写入和归档
- 遇到真实行为与旧规则冲突时，以当前真实库结构和 CLI 实测结果为准

## 笔记本、文档、块

### 笔记本

- 是知识域边界
- 适合决定“内容属于哪里”
- 一般不在普通写作任务里改动笔记本本身
- 查看：`siyuan notebook list -w <ws> -f json`

### 文档

- 是默认主维护单位
- llm-wiki 的 page 在思源里优先映射为文档
- 项目页、主题页、周记页、承接页都优先按文档处理
- 读取：`siyuan document get --id <docID>`、`siyuan block kramdown --id <docID>`

### 块

- 用于局部结构和精修
- 用于定位某段事实、某个标题、某个引用点
- 不适合默认承担全局知识组织责任
- 读取：`siyuan block children --id <id>`、`siyuan block get --id <id>`

## 路径

存在三种常见路径理解方式：

- **笔记本 ID** （`box`）
- **人类可读路径 hpath，** 如 `/001.账号与服务/001.平台账号/000.通用账号汇总`
- **底层存储 path，** 如 `/20231012093834-8deu0z5/.../20231012094801-7hie0kp.sy`

使用规则：

- 对用户汇报时优先用 **hpath**
- 需要精确定位时用 `siyuan document get --id <docID>`（结果含 hPath）
- 按路径列目录用 `siyuan document list --notebook <nbID> --path /` 或 `--hpath "/归档/文章"`
- 按路径落位新建 / 导入时用 `--path` / `--hpath` 参数
- 搜索结果的 `hPath` 字段可直接用于向用户复述位置

## 属性与标签

- `memo` / `tags` / `alias` 属于属性层
- 读取：`siyuan attr get --id <id>`（批量 `siyuan attr batch-get`）
- 写入：`siyuan attr set --id <id> --attr memo=... --attr tags=标签A,标签B`
- 标签清单：`siyuan tag list -w <ws> -f json`

不要因为读取时看见 frontmatter，就把 frontmatter 当成属性主接口。

## Daily Note 与笔记本配置

- daily note 路径来自**笔记本配置**
- 「追加到今日笔记」与「按固定周记树维护周记」是两件事

因此：

- 处理 daily note 时用 `siyuan dailynote append / create / prepend --notebook <nbID>`
- 处理周记归档时看真实周记文档树（`siyuan document list --notebook <nbID>`）

### 重要缺口

当前 CLI **没有** 读取或写入笔记本配置（daily note 路径模板等）的命令。
因此：

- **不得硬编码** daily note 路径
- **不得** 为了拿到路径去直接改 `conf.json` 或 `siyuan.db`
- 无法从真实上下文确认笔记本归属时，先问用户

## 双链 / 引用边界

### 可以做的

- 保留现有 `siyuan://blocks/...` 链接
- 在确知块 ID 时写入块链接
- 用 `siyuan block breadcrumb` / `siyuan block get` 理解块位置
- 用 `siyuan ref backlinks` / `siyuan ref mentions` 看引用与提及
- 用 SQL 查 `spans` / `refs` 做 best-effort 检索

### 不能假设的

- 不要假设每个 block-ref 都是知识图谱意义上的双链
- 不要假设引用目标一定存在
- 不要为了“制造双链”而虚构或猜测 ID

默认策略：

- 双链是增强层
- 文档结构和搜索结果才是主导航手段

## ID 形态

- 块 / 文档 ID 形如 `20240110144035-xxn8zfh`
- 文档本身也是一个块，其 ID 即 docID
- 标题在 `content` 字段，`hPath` 是人类可读路径，`path` 是内部 `.sy` 文件路径
- 内部链接格式：`[文本](siyuan://blocks/<id>)`

## 大库分析边界

当前库是大库场景。
因此：

- 先用搜索或分页缩小范围
- 做全库 SQL 巡检时显式分页（`LIMIT / OFFSET`）
- 不要把少量样本的结构误判成全库结构
