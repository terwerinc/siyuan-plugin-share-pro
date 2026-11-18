# SiYuan CLI 能力矩阵

本页说明 **真实可用能力、** **默认主链路能力、** **当前缺失能力** 与 **不能过度依赖的边界。**

> 能力来源：本机 `siyuan` 内核 CLI（`SiYuan-Kernel`）的 `--help` 实测输出。
> 任何命令在使用前，仍应以 `siyuan <cmd> --help` 为准。

## 总原则

- 主链路以 **文档级操作** 为核心
- 块级操作用于精修，不用于默认全局维护
- SQL 用于巡检、统计、补充检索，不用于替代常规写作流程
- 大库检索或全库分析时，**不要假设一次 SQL 就能拿全量结果；** 显式分页或分批
- 每个命令都显式带 `-w <workspace>`；机器解析一律 `-f json`
- 写操作先 `--dry-run` 演练

## 默认主链路能力

### 搜索定位

| 用途 | 命令 |
| --- | --- |
| 全文关键词 | `siyuan search "<q>"` |
| 语义检索 | `siyuan search "<q>" -m 4` |
| 查询语法 | `siyuan search "<q>" -m 1` |
| SQL 语法检索 | `siyuan search "<q>" -m 2` |
| 正则检索 | `siyuan search "<q>" -m 3` |
| 按块类型过滤 | `siyuan search "<q>" -t heading -t paragraph` |
| 按块子类型过滤 | `siyuan search "<q>" --subtype h2` |
| 限定笔记本（可重复） | `siyuan search "<q>" -n <notebookID>` |
| 路径前缀过滤（可重复） | `siyuan search "<q>" --path /001.账号与服务` |
| 分页 | `siyuan search "<q>" -s 20 -p 1` |
| 排序 | `siyuan search "<q>" -o 4`（4=updated-desc） |
| 按文档分组 | `siyuan search "<q>" -g 1` |
| 资源文件内容（PDF/Word/Excel/txt） | `siyuan search "<q>" --asset --ext pdf` |
| 读取某个资源文件的完整索引内容 | `siyuan search "assets/foo.pdf" --get-asset` |
| 文档级关键词搜索 | `siyuan document search "<keyword>"` |
| 文档树 / 目录 | `siyuan document list --notebook <nbID> [--path /] [--hpath "/归档/文章"]` |
| 文档标题大纲树 | `siyuan outline get --id <docID>` |

`search` 的 `-m/--method`：`0=keyword 1=query-syntax 2=sql 3=regex 4=semantic`。
语义检索（`-m 4`）依赖 `conf.json` 已配置 `ai.embedding`，未配置时不可用。

### 文档读取与写入

| 用途 | 命令 |
| --- | --- |
| 文档元信息（标题/别名/标签/备忘） | `siyuan document get --id <docID>` |
| 文档全文 kramdown | `siyuan block kramdown --id <docID>` |
| 文档全文（导出视图） | `siyuan export md --id <docID> [--output <file>]` |
| 子块列表 | `siyuan block children --id <id>` |
| 新建文档 | `siyuan document create --notebook <nbID> --title "<title>" [--markdown <md>] [--path /]` |
| 尾部追加 | `siyuan block append --parent <docID> --data <md>` |
| 头部插入 | `siyuan block prepend --parent <docID> --data <md>` |
| 指定兄弟位置插入 | `siyuan block insert --parent <parentID> --previous <siblingID> --data <md>` |
| 修改块 | `siyuan block update --id <blockID> --data <md>` |
| 重命名文档 | `siyuan document rename --id <docID> --title "<title>"` |
| 移动文档 | `siyuan document move --id <docID> --notebook <nbID> [--path /] [--hpath "<hpath>"]` |
| 复制文档 | `siyuan document duplicate --id <docID>` |
| 删除文档 | `siyuan document remove --id <docID>` |
| 移动块 | `siyuan block move --id <blockID> --parent <parentID> [--previous <siblingID>]` |
| 删除块 | `siyuan block delete --id <blockID>` |
| 块位置上下文 | `siyuan block breadcrumb --id <blockID>` |
| 块信息 | `siyuan block get --id <blockID>` |
| 块内容统计 | `siyuan block stat --id <blockID>` |

多行 Markdown 写入规则：

- 优先用 `--file <path>`，或 `--file -` 从 stdin 读入
- 不要把 `\n` 当作普通字符写进正文
- 覆盖式写入前必须先读完整文档并保留有效结构

### 元信息

| 用途 | 命令 |
| --- | --- |
| 读块属性 | `siyuan attr get --id <id>` |
| 批量读属性 | `siyuan attr batch-get` |
| 写块属性 | `siyuan attr set --id <id> --attr name=value` |
| 标签清单 | `siyuan tag list [--keyword <kw>]` |
| 重命名标签 | `siyuan tag rename --old <old> --new <new>` |
| 删除标签 | `siyuan tag remove --label <label>` |

`attr set` 的 `--attr` 可重复；常见属性：`tags`（逗号分隔）、`icon`、`title-img`。
`memo` / `alias` 也通过 `--attr memo=...` / `--attr alias=...` 写入。

### 日记（Daily Note）

| 用途 | 命令 |
| --- | --- |
| 追加到今日日记 | `siyuan dailynote append --notebook <nbID> --data <md>` |
| 创建今日日记 | `siyuan dailynote create --notebook <nbID>` |
| 插入到今日日记开头 | `siyuan dailynote prepend --notebook <nbID> --data <md>` |

### SQL

- `siyuan sql "<statement>" [-l <limit>]`：默认最多返回 100 行，必要时显式 `LIMIT / OFFSET`
- 适用：全库统计、特殊检索、引用 / span / tag 分布巡检、结构健康检查
- 不适用：替代常规文档写入；一次拿全量全文上下文

### 快照与历史

| 用途 | 命令 |
| --- | --- |
| 建快照 | `siyuan repo create [--memo "<说明>"]` |
| 快照列表 | `siyuan repo list [-p <page>] [--tag]` |
| 快照差异 | `siyuan repo diff` |
| 快照内文件 | `siyuan repo file` |
| 回滚到快照 | `siyuan repo checkout --id <snapshotID>` |
| 给快照打标 | `siyuan repo tag` / `siyuan repo untag` |
| 清理旧快照 | `siyuan repo purge` |
| 文档历史版本 | `siyuan history list` / `history get` / `history rollback` / `history search` / `history clear` |

使用规则：批量删除、批量移动、标签批量变更、覆盖式改写大量文档前，优先 `repo create` 建快照。
`repo create` 前提是该空间已在思源「设置→账号与同步→本地数据仓库」初始化数据仓库密钥。

### 引用

| 用途 | 命令 |
| --- | --- |
| 反向链接 | `siyuan ref backlinks --id <blockID> [--keyword <kw>] [--sort <n>]` |
| 提及 | `siyuan ref mentions --id <blockID> [--keyword <kw>] [--sort <n>]` |
| 刷新引用 | `siyuan ref refresh` |

### 文件 / 导出 / 资源 / 模板

| 用途 | 命令 |
| --- | --- |
| 工作空间文件读写 | `siyuan file read / write / list / find / grep / copy / rename / delete / stat` |
| 导出 Markdown | `siyuan export md --id <docID> [--output <file>]` |
| 批量导出 Markdown | `siyuan export md-zip` |
| 导出其他格式 | `siyuan export docx / html / sy / data / preview` |
| 上传资源 | `siyuan asset upload --id <docID> --file <localPath>` |
| 资源巡检 | `siyuan asset stat / unused / clean` |
| 模板 | `siyuan template create / get / render / search / save-as / remove` |

这些能力存在，但不是默认主链路：用于工作区文件、模板、导出、资源管理，不用于常规思源文档维护。

## 当前缺失能力

以下能力 **目前没有对应命令。** 需要时必须先向用户说明「无此能力」，
**不得通过直接改 `siyuan.db` / `conf.json` 等方式蛮干绕过：**

| 缺失能力 | 说明 |
| --- | --- |
| 笔记本配置读写 | `siyuan notebook` 只有 `list / create / rename / remove / open / close / set-icon / random-icon`，**无配置读写** |
| 列出日记未完成待办 | `dailynote` 只有 `append / create / prepend`，无待办列举命令 |
| 折叠 / 展开块 | 无折叠、展开命令 |
| 块引用转移 | 无块引用转移命令 |
| 批量替换块内标签 | 只有标签级 `tag rename` 与 `tag remove`，**不是** 块内批量替换 |
| 独立 Sprig 渲染 | 只有 `template render --path --id`（针对块的预览渲染） |
| 事务刷新 | 无事务刷新命令 |
| 思源内消息推送 | 无消息推送命令 |
| 笔记本排序 | 无排序命令 |
| 自动快照开关 | 无自动快照开关；同步产生的快照会出现在 `repo list` 中（memo 形如 `[Sync] ...`） |

## 需要谨慎理解的边界

### `block kramdown` vs `export md`

- `block kramdown`：底层 kramdown 视图，**含块 IAL 属性行，** 适合结构化理解与精修
- `export md`：导出 Markdown 视图，读到的 `title/date/lastmod` frontmatter 是**导出表现**
- 不要把导出 frontmatter 当成主写入元数据接口

### 引用边界

- 可以读取现有 `siyuan://blocks/...` 链接
- 可以用 `block breadcrumb` / `block get` 理解块位置
- 可以用 `ref backlinks` / `ref mentions` 看引用与提及
- 可以用 SQL 查 `spans` / `refs` 做 best-effort 检索
- 不要把 block-ref 当成默认核心知识组织方式

### 大库扫描

- 使用 `search` 的分页参数（`-p` / `-s`）
- 或者用 `sql` 的 `LIMIT / OFFSET`
- 避免一次性拉取全库后做未经控制的大改写

### 整页覆盖写入

当前 **没有** 整页替换文档的命令，只有 `block update --id <id>`。
用文档块 ID 执行 `block update` 能否整页覆盖，**尚未实测确认；**
需要整页改写时应先 `--dry-run` 实测，或采用「读全文 → 重建内容 → 分块写入」的保守流程，
不要直接假设行为。
