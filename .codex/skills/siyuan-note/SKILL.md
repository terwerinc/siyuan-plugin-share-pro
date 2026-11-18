---
name: siyuan-note
description: Use when the user wants to search, read, create, or organize notes in SiYuan (思源笔记) as a knowledge base through the official native `siyuan` kernel CLI. Covers full-text/semantic search, documents, blocks, notebooks, daily notes, tags, backlinks, SQL queries, snapshots, and import/export.
---

# 思源笔记（SiYuan Note）知识库

通过思源官方原生内核 CLI `siyuan`（即 `SiYuan-Kernel`，本机实测 v3.8.5，以 `siyuan --version` 为准）把思源笔记当作知识库使用。无需 GUI、无需 HTTP 服务，直接对工作空间数据读写。

## 基本信息

- 可执行文件：`siyuan`（已加入 PATH，实际指向 `/Applications/SiYuan.app/Contents/Resources/kernel/SiYuan-Kernel`）
- 全局参数：
  - `-w, --workspace <path>`：工作空间路径。**每个命令都必须显式指定，绝不省略。**
  - `-f, --format table|json`：输出格式。给机器/程序解析一律用 `-f json`。
  - `--dry-run`：只校验不落盘，任何写操作先跑一遍演练。
  - `-v, --log-level off|trace|debug|info|warn|error|fatal`。

## 三个工作空间（安全等级）

| 用途 | 路径 | 策略 |
| --- | --- | --- |
| 🧪 测试 | `/Volumes/workspace/mydocs/SiYuanWorkspace/test` | 可放心读写、测试 |
| 🛠 开发 | `/Volumes/workspace/mydocs/SiYuanWorkspace/dev` | 开发用，写入需谨慎 |
| 🔴 生产/真实 | `/Volumes/workspace/mydocs/SiYuanWorkspace/public` | **真实数据，极度谨慎，默认只读** |

## 安全铁律

> ⚠️ **最高优先级指令（每次写操作前后必做，切勿遗忘）：** 任何 **写/维护操作** （新建、修改、追加、删除、移动、导入导出、属性/标签变更等）都要按 **pull → 操作 → push** 的顺序执行：**操作前先 `siyuan sync pull -w <ws>` 拉取云端最新** （确保基于最新数据操作，避免在旧数据上动手），**操作完成后立即 `siyuan sync push -w <ws>` 上传本地变更** （必要时先 `siyuan sync status -w <ws> -f json` 确认），确保本地与云端一致后方可结束任务。**严禁操作完成后先 pull 再 push** ——那样会把云端尚未同步的旧数据拉回本地、回滚掉刚做的删除/修改（已实测踩坑）。这条优先级高于其他一切常规步骤，Agent 极容易忘记，必须严格遵守。

1. 每个命令都显式带 `-w <workspace>`，绝不省略。
2. 对 `public` 空间：默认只读；**任何写入/删除/移动操作必须先征得用户明确同意。**
3. 写操作先在 `test` 空间验证，`dev` 次之，`public` 最后且需确认。
4. 破坏性命令（`document remove`、`block delete`、`notebook remove`、`history rollback`、`repo checkout`、`tag remove`）务必先 `--dry-run`，再经用户确认后执行。
5. 大规模写操作前先 `repo create` 建快照兜底（前提：该空间已在思源「设置→账号与同步→本地数据仓库→数据仓库密钥」初始化密钥，否则 `repo create` 会报错）。
6. **每次写/维护操作按「pull → 操作 → push」顺序执行** （见上方最高优先级指令），不得遗漏：操作前 pull 拉云端最新，操作完成后 push 推本地变更；**严禁操作完成后先 pull** （会把删除/修改回滚成云端旧数据）。
7. **维护/整理完成后必须归一化序号：** 目录与文档的编号前缀（`000.`/`001.`/`002.`…）要保持连续、不留断档——缺号补全、错号（如 `0030.`）纠正；编号方案不确定时先与用户确认，不擅自臆测。
8. **CLI 没有的能力直接报告，禁止猜测、禁止蛮干：** `siyuan` 各子命令能力以 `siyuan <cmd> --help` 为准；凡 CLI 无对应命令（如笔记本排序、笔记本配置读写、列出日记待办）或参数语义不确定的，立即向用户说明「无此能力/无法确认」，不得通过直接改数据库（`siyuan.db`）、配置文件（`conf.json`）等方式蛮干绕过。完整缺口清单见 `references/capabilities.md`。同笔记本内重排层级是否可由 `siyuan document move --notebook <同一笔记本> --path/--hpath` 完成，**尚未实测，** 需要时先 `--dry-run` 验证再动手。

## 常用工作流

### 1. 搜索知识（全文 / 语义 / 资源文件）
```bash
siyuan search "关键词" -w <ws> -f json
siyuan search "关键词" -w <ws> -f json -t heading      # 只搜标题块
siyuan search "关键词" -w <ws> -f json -n <notebookID> # 限定笔记本（-n 可重复）
siyuan search "关键词" -w <ws> -f json -s 20 -p 1      # 每页 20 条、第 1 页
# 语义搜索（需 conf.json 已配 ai.embedding 服务）
siyuan search "语义问题" -w <ws> -f json -m 4
# 搜资源文件内容（PDF/Word/Excel 等）
siyuan search "关键词" -w <ws> -f json --asset --ext pdf
```
结果中每个块含 `id`、`box`(笔记本ID)、`hPath`(人类路径)、`content`、`markdown`、`tag`、`memo`、`ial` 等字段。

### 2. 列出笔记本 / 文档
```bash
siyuan notebook list -w <ws> -f json
siyuan document list --notebook <nbID> -w <ws> -f json
siyuan document list --notebook <nbID> --path / -w <ws> -f json
```

### 3. 读取一篇文档全文（Markdown）
```bash
siyuan document get --id <docID> -w <ws> -f json     # 元信息（标题 content/别名 alias/标签 tag/备忘 memo）
siyuan block kramdown --id <docID> -w <ws> -f json   # 全文 kramdown markdown（含块 IAL 属性行）
siyuan block children --id <docID> -w <ws> -f json   # 子块列表（每块带 markdown/content）
siyuan outline get --id <docID> -w <ws> -f json      # 标题大纲树
```

### 4. 按标题定位文档
```bash
siyuan document search "标题关键词" -w <ws> -f json
```

### 5. 新建 / 追加 / 修改内容
```bash
# 新建文档
siyuan document create --notebook <nbID> --title "标题" --markdown "# 标题" -w <ws> -f json
# 追加块（--data 与 --file 二选一）
siyuan block append --parent <docID> --data "## 小节" -w <ws> -f json
# 修改块
siyuan block update --id <blockID> --data "新内容" -w <ws> -f json
# 插入到某兄弟块之前
siyuan block insert --parent <parentID> --previous <siblingID> --data "..." -w <ws> -f json
```
多行 Markdown 避免 shell 转义：优先写入临时文件再用 `--file <path>`，或用 stdin（`--file -`）。

### 6. 日记（Daily Note）
```bash
siyuan dailynote append --notebook <nbID> --data "- [ ] 待办" -w <ws> -f json
```

### 7. 结构化查询（SQL 直查笔记数据库）
```bash
siyuan sql "select count(*) as c from blocks" -w <ws> -f json
siyuan sql "select id, box, hpath, type from blocks where type='d' limit 10" -w <ws> -f json
```

### 8. 反向链接 / 引用 / 标签 / 属性
```bash
siyuan ref backlinks --id <blockID> -w <ws> -f json
siyuan tag list -w <ws> -f json
siyuan attr get --id <blockID> -w <ws> -f json
```

### 9. 快照 / 历史（数据保护）
```bash
siyuan repo list -w <ws> -f json          # 快照列表
siyuan repo create --memo "说明" -w <ws> -f json   # 建快照（大改前建议先做）
siyuan history list -w <ws> -f json       # 文档历史版本
```

> 注意：`history` 是定时生成（默认每 10 分钟），刚写入/修改的文档可能还没有历史版本（`history list` 为空、`history rollback` 暂不可用）。需要即时回滚时应优先用 `repo` 快照（同样需先初始化数据仓库密钥）。

### 10. 导入 / 导出
```bash
siyuan export md --id <docID> -w <ws>             # 导出 Markdown 到 stdout
siyuan export md --id <docID> --output /tmp/x.md -w <ws>
siyuan import md --file <md文件> --notebook <nbID> -w <ws> -f json
```

## 参考导航

- **CLI 能力矩阵 / 缺失能力 / 风险边界** → `references/capabilities.md`
- **对象模型 / 路径 / 块与双链边界** → `references/siyuan-model.md`
- **页面类型 / 目标页判断 / 容器页与索引页** → `references/wiki-page-types.md`
- **快速记录 / TODO / Daily Note 整理 / 周报草稿** → `references/operations.md`
- **周记归档 / 未完成迁移 / 承接页** → `references/weekly-archive.md`
- **tags / memo / alias / 属性写入** → `references/metadata.md`
- **写作风格 / Markdown 格式 / 内部链接 / 归档语言** → `references/write-rules.md`

## 其他子命令速查

- `attr`：块属性（get / set / batch-get）
- `bookmark`：书签（list / labels / rename / remove）
- `database`：属性视图数据库（get / keys / item / render / search / clean / unused）
- `template`：模板（create / get / render / search / save-as / remove）
- `file`：工作空间文件操作（list / read / write / find / grep / copy / rename / delete / stat）
- `asset`：资源文件管理
- `sync`：云端同步（status / pull / push）
- `inbox`：云端收集箱（list / get / convert）
- `history`：数据历史（list / get / rollback / clear）
- `repo`：数据快照（list / create / diff / checkout / tag / purge）
- `serve`：启动内核 HTTP 服务（适合需要长驻服务的场景；日常知识库读写直接走 CLI 直连工作空间即可，无需 serve）
- `workspace`：已注册工作空间（list / info）
- `system current-time`：服务器时间
- `completion`：生成 shell 自动补全脚本

## 注意

- 内核首次运行会向 `~/.config/siyuan/` 写 `workspace.json` 与 `kernel.log`（状态文件），属正常现象。
- 思源块/文档 ID 形如 `20240110144035-xxn8zfh`；标题在 `content` 字段，`hPath` 是人类可读路径，`path` 是内部 `.sy` 文件路径。
- 思源内部链接格式：`[文本](siyuan://blocks/<id>)`。
- 不要与桌面端（SiYuan.app）同时打开同一工作空间做写操作，避免数据锁冲突；CLI 适合在桌面端未占用该空间时使用。
- 不确定某命令参数时，先 `siyuan <cmd> --help` 查精确用法，不要臆测。
