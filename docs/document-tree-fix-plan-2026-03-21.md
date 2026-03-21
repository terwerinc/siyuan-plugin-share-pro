# 文档树实现的根本性设计缺陷修复方案

## 背景和问题分析

### 当前实现是"假的"文档树
- **现有实现方式**：当前的文档树实现仅基于文档路径（hpath）的字符串分割，无法反映真实的文档关系
- **缺少关键文档关系**：无法显示同级文档（siblings）、子级文档（children）和父级文档（parents）的真实层级结构
- **用户体验误导**：用户期望看到完整的文档树结构，但实际只看到路径分解，这严重违背了用户预期

### 用户期望的文档树结构
用户期望的文档树应该显示：
- **同级文档**：同一父目录下的其他文档
- **子级文档**：当前文档下的所有子文档
- **父级文档**：当前文档的父目录、祖父目录等
- **根据深度级别控制**：支持指定深度级别的文档树展示（1-6级）

## 解决方案概述

重构文档树生成逻辑，使用思源官方API获取真实的文档关系结构，实现完整的文档树展示。

### 核心设计原则
1. **真实文档关系**：使用思源官方 `/api/filetree/listDocsByPath` API 获取真实的文档树结构
2. **完整层级展示**：同时显示父级、同级、子级文档
3. **深度级别控制**：支持指定深度级别的文档树展示
4. **最小化改动**：基于现有架构进行扩展，避免大规模重构

## 详细实施方案

### 1. 重构 SiYuanApiAdaptor 中的文档树实现

**文件路径**: `zhi-siyuan-api/src/lib/adaptor/siYuanApiAdaptor.ts`

**关键修改**:
- 移除基于路径的假文档树实现（行183-234）
- 集成真实的文档树获取逻辑

```typescript
// 在 getPost 方法中替换原有的文档树逻辑
// 处理文档树
let docTree = []
let docTreeLevel = 3
if (this.cfg?.preferenceConfig?.docTreeEnable) {
  docTreeLevel = this.cfg?.preferenceConfig?.docTreeLevel ?? 3

  // 获取文档的基本信息
  const notebookId = siyuanPost.box || ""
  const docPath = siyuanPost.path || `/${siyuanPost.root_id}.sy`

  // 构建完整的文档树结构
  // 1. 获取父级路径信息
  const pathParts = docPath.replace(".sy", "").split("/").filter(part => part.trim() !== "")
  const parentPaths = []
  for (let i = 0; i < pathParts.length - 1 && i < docTreeLevel; i++) {
    parentPaths.push({
      id: pathParts[i],
      parentId: i > 0 ? pathParts[i - 1] : "",
      name: pathParts[i],
      depth: i,
      type: "parent"
    })
  }

  // 2. 获取同级文档（父目录下的其他文档）
  const parentPath = pathParts.slice(0, -1).join("/")
  const siblings = await this.siyuanKernelApi.getSiblingDocs(notebookId, parentPath)

  // 3. 获取子级文档（当前文档下的所有子文档）
  const children = await this.siyuanKernelApi.getChildDocs(notebookId, docPath, docTreeLevel)

  // 4. 合并所有文档树节点
  docTree = [...parentPaths, ...siblings, ...children]
  this.logger.info("检测到配置，真实的文档树已获取")
}
```

### 2. 增强 SiyuanKernelApi 的文档树功能

**文件路径**: `zhi-siyuan-api/src/lib/kernel/siyuanKernelApi.ts`

**关键修改**:
- 添加 `getSiblingDocs` 方法：获取指定路径下同级文档
- 添加 `getChildDocs` 方法：获取指定文档的子级文档（支持深度控制）

```typescript
// 获取同级文档（父目录下的其他文档）
public async getSiblingDocs(notebook: string, parentPath: string): Promise<any[]> {
  if (!parentPath || parentPath === "/") {
    return [] // 根目录没有同级文档
  }

  const response = await this.siyuanRequest("/api/filetree/listDocsByPath", {
    notebook: notebook,
    path: parentPath
  })

  if (!response || !Array.isArray(response.files)) {
    return []
  }

  return response.files.map(file => ({
    id: file.id,
    parentId: parentPath.split("/").pop() || "",
    name: file.name.replace(".sy", ""),
    depth: 0, // 同级文档深度为0
    type: "sibling"
  }))
}

// 获取子级文档（递归到指定深度）
public async getChildDocs(notebook: string, docPath: string, maxDepth: number = 3): Promise<any[]> {
  const children = []
  await this._recursiveGetChildren(notebook, docPath, children, 1, maxDepth)
  return children
}

private async _recursiveGetChildren(notebook: string, currentPath: string, result: any[], currentDepth: number, maxDepth: number): Promise<void> {
  if (currentDepth > maxDepth) {
    return
  }

  const response = await this.siyuanRequest("/api/filetree/listDocsByPath", {
    notebook: notebook,
    path: currentPath
  })

  if (!response || !Array.isArray(response.files)) {
    return
  }

  for (const file of response.files) {
    const filePath = file.path
    const fileName = file.name.replace(".sy", "")
    const pathParts = filePath.replace(".sy", "").split("/").filter(part => part.trim() !== "")
    const parentId = pathParts[pathParts.length - 2] || ""

    result.push({
      id: file.id,
      parentId: parentId,
      name: fileName,
      depth: currentDepth,
      type: "child",
      hasChildren: (file.subFileCount || 0) > 0
    })

    // 递归获取子文档
    if ((file.subFileCount || 0) > 0) {
      await this._recursiveGetChildren(notebook, filePath, result, currentDepth + 1, maxDepth)
    }
  }
}
```

## 关键文件修改清单

1. **修改文件**:
   - `zhi-siyuan-api/src/lib/adaptor/siYuanApiAdaptor.ts` - 重构文档树实现，使用真实API
   - `zhi-siyuan-api/src/lib/kernel/siyuanKernelApi.ts` - 增强文档树功能，添加获取同级和子级文档的方法

## 测试验证方案

### 功能测试
1. **文档树结构验证**：
   - 验证文档树显示真实的同级、子级、父级文档
   - 验证不同深度级别的文档树展示（1-6级）
   - 验证文档树与文档大纲功能的一致性
   - 验证文档树在分享页面的正确显示

2. **边界情况测试**：
   - 根目录文档的文档树显示
   - 没有子文档的文档树显示
   - 深度级别为1时的文档树显示
   - 深度级别为6时的文档树显示

### 回归测试
- 确保现有文档分享功能不受影响
- 验证文档级别和全局配置的优先级逻辑
- 验证子文档分享和引用文档分享功能

## 实施优先级

1. **第一阶段**：增强 SiyuanKernelApi 的文档树功能（添加 getSiblingDocs 和 getChildDocs 方法）
2. **第二阶段**：重构 SiYuanApiAdaptor 中的文档树实现
3. **第三阶段**：全面测试和验证

这个方案完全满足用户需求：
- ✅ 文档树显示真实的文档关系（同级、子级、父级）
- ✅ 支持指定深度级别的文档树展示
- ✅ 提供符合付费软件标准的专业用户体验