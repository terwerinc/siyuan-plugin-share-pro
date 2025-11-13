## 1. 系统架构

### 1.1 系统架构图

```
+----------------------------------------+
|              思源笔记客户端              |
|                                        |
|  +--------------+   +----------------+  |
|  | ShareProPlugin|   | 思源笔记核心API  |  |
|  +-------+------+   +--------+-------+  |
|          |                   |          |
|          v                   v          |
|  +--------------+   +----------------+  |
|  |   ShareService|   |   文档数据存储    |  |
|  +-------+------+   +--------+-------+  |
|          |                   |          |
|          v                   v          |
|  +----------------------------------+  |
|  |          组合式函数模块            |  |
|  |  +------------+  +-------------+ |  |
|  |  | useDataTable|  |useEmbedBlock| |  |
|  |  +------------+  +-------------+ |  |
|  |  +------------+  +-------------+ |  |
|  |  |   useFold   |  | useSiyuanApi| |  |
|  |  +------------+  +-------------+ |  |
|  +----------------------------------+  |
|                   |                    |
+-------------------|--------------------+
                    v
+----------------------------------------+
|              分享服务API                |
|                                        |
|  +--------------+   +----------------+  |
|  |  ShareApi    |   | 资源处理服务    |  |
|  +-------+------+   +--------+-------+  |
|          |                   |          |
|          v                   v          |
|  +----------------------------------+  |
|  |        服务端存储与处理             |  |
|  |  +------------+  +-------------+ |  |
|  |  | 文档存储    |  |媒体资源存储   | |  |
|  |  +------------+  +-------------+ |  |
|  |  +------------+  +-------------+ |  |
|  |  |DataViews处理 | |权限管理      | |  |
|  |  +------------+  +-------------+ |  |
|  +----------------------------------+  |
+----------------------------------------+
```

### 1.2 组件说明

| 组件 | 职责 | 技术栈 | 位置 |
|------|------|--------|------|
| ShareProPlugin | 插件入口，管理配置和生命周期 | TypeScript, Svelte | src/index.ts |
| ShareService | 处理分享核心业务逻辑 | TypeScript | src/service/ShareService.ts |
| useDataTable | 处理DataViews数据提取与转换 | TypeScript, cheerio | src/composables/useDataTable.ts |
| useEmbedBlock | 处理嵌入块内容 | TypeScript | src/composables/useEmbedBlock.ts |
| useFold | 处理折叠块内容 | TypeScript | src/composables/useFold.ts |
| useSiyuanApi | 提供思源笔记API访问 | TypeScript | src/composables/useSiyuanApi.ts |
| ShareApi | 封装分享服务API调用 | TypeScript | src/api/share-api.ts |
| ImageUtils | 图片处理工具函数 | TypeScript | src/utils/ImageUtils.ts |
| ApiUtils | API调用工具函数 | TypeScript | src/utils/ApiUtils.ts |

### 1.3 数据流向

1. **客户端数据提取**：
   - 从思源笔记获取文档内容
   - 提取文档中的DataViews、嵌入块、折叠块等特殊元素
   - 收集需要处理的媒体资源

2. **服务端交互**：
   - 文档内容上传至分享服务
   - 媒体资源分批上传
   - DataViews资源单独处理和上传

3. **资源处理流程**：
   - 文本内容直接序列化传输
   - 图片资源转换为base64格式传输
   - DataViews资源提取视图定义和数据后传输

## 2. 详细业务处理流程

### 2.1 DataViews资源处理流程

#### 前置条件
- 思源笔记客户端已安装SharePro插件
- 插件配置已完成，包含有效的服务端API地址和认证信息
- 待分享文档中包含DataViews组件

#### 执行逻辑

1. **DataViews识别与提取**
   ```typescript
   // 在useDataTable.ts中
   const getDataViews = async (editorDom: string) => {
     // 使用cheerio解析HTML内容
     const $ = cheerio.load(editorDom)
     // 查找所有数据表格元素
     const dataTables = $("div[data-av-type='table']")
     // 提取dataTableId和defaultViewId
     const dataTableIds: { dataTableId: string; defaultViewId?: string }[] = []
     
     dataTables.each((index, element) => {
       const dataTableId = $(element).attr("data-av-id")
       const defaultViewId = $(element).attr("custom-sy-av-view")
       if (!dataTableId) {
         return
       }
       dataTableIds.push({ dataTableId, defaultViewId })
     })
     
     // 请求DataViews数据
     // ...
   }
   ```

2. **DataViews数据获取**
   - 对每个识别到的DataView，调用思源API获取其视图定义和数据
   - 优先获取默认视图数据
   - 然后并发获取其他可用视图数据
   - 保存视图数据的顺序信息

3. **分享创建与数据传输**
   ```typescript
   // 分享创建与数据传输
    ```typescript
    // 在ShareService.ts中
    public async createShare(docId: string, settings?: Partial<SingleDocSetting>, options?: Partial<ShareOptions>) {
      // ...
      // 获取DataViews数据
      const dataViews = await getDataViews(post.editorDom)
      sPost.dataViews = dataViews
      // ...
      // 调用服务端API创建分享
      const resp = await this.shareApi.createShare(shareBody)
      // ...
      // 目前处理图片媒体资源的逻辑
      const data = resp.data
      const media = data.media
      if (media && media.length > 0) {
        showMessage(this.pluginInstance.i18n["shareService"]["msgProcessPic"], 7000, "info")
        // 异步处理图片
        this.addLog(this.pluginInstance.i18n["shareService"]["msgStartPicBack"], "info")
        void this.processShareMedia(docId, media)
        this.addLog(this.pluginInstance.i18n["shareService"]["msgEndPicBack"], "info")
      } else {
        showMessage(this.pluginInstance.i18n["shareService"]["msgShareSuccess"], 3000, "info")
      }
      // ...
    }
    ```

4. **媒体资源处理**
    - 从服务端返回的media列表中识别需要上传的图片资源
    - 对每个图片资源，获取其base64编码和类型信息
    - 分组批量上传媒体资源到服务端

#### 异常处理

1. **DataViews识别失败**
   - 记录错误日志
   - 继续处理其他文档内容，不中断整体分享流程

2. **API调用失败**
   - 捕获异常并记录详细错误信息
   - 显示用户友好的错误提示
   - 支持重试机制

3. **媒体资源上传失败**
   - 分组处理，单个资源失败不影响整体上传
   - 统计成功和失败数量
   - 显示详细的处理结果报告

#### 后续操作

1. **更新分享状态**
   - 更新文档属性，标记分享状态和时间
   - 更新状态栏显示

2. **资源清理**
   - 清理临时生成的资源
   - 释放不再需要的内存

### 2.2 核心API调用流程

#### createShare调用流程
1. 客户端准备分享数据，包括文档内容和特殊组件信息
2. 调用服务端createShare接口
3. 服务端处理分享数据，识别需要上传的媒体资源
4. 服务端返回包含media和dataViewMedia的结果
5. 客户端异步处理需要上传的媒体资源

#### uploadMedia调用流程 (当前实现)
1. 客户端获取图片媒体资源的base64编码
2. 调用服务端uploadMedia接口
3. 服务端接收并处理媒体资源
4. 返回处理结果

#### uploadDataViewMedia调用流程 (待实现)
1. 客户端获取DataViews媒体资源的base64编码
2. 调用服务端uploadDataViewMedia接口
3. 服务端接收并处理DataViews媒体资源
4. 返回处理结果

## 3. Implementation
- [ ] 3.1 分析DataViews数据结构，特别是mAsset类型资源的存储方式
- [ ] 3.2 更新ShareService.ts中的createShare方法，调用服务端接口并返回包含dataViewMedia字段的结果
- [ ] 3.3 在ShareService中实现轻量级的uploadDataViewMedia方法，该方法主要调用服务端接口
- [ ] 3.4 为ResourceInfo接口添加source字段，标识资源来源为DataViews
- [ ] 3.5 确保客户端正确处理和显示服务端返回的DataViews资源
- [ ] 3.6 编写客户端与服务端接口调用的单元测试
- [ ] 3.7 更新文档和JSDoc注释，说明客户端轻量级实现的工作原理