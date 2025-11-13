## MODIFIED Requirements

### Requirement: ShareService createShare 方法
ShareService 的 createShare 方法 MUST 返回服务端处理后的 dataViewMedia 字段。

#### Scenario: 返回 DataViews 媒体资源
- **WHEN** 分享包含 DataViews 的文档时
- **THEN** 系统 MUST 将内容发送到服务端进行处理
- **THEN** 系统 MUST 返回服务端处理后的结果，包含 dataViewMedia 字段，存储提取的资源信息

## ADDED Requirements

### Requirement: ShareService uploadDataViewMedia 方法
系统 SHALL 提供轻量级的 uploadDataViewMedia 方法，该方法主要职责是调用服务端接口。

#### Scenario: 上传 DataViews 媒体资源
- **WHEN** 需要上传 DataViews 中的媒体资源时
- **THEN** 系统 SHALL 调用客户端的 uploadDataViewMedia 方法
- **THEN** 客户端方法 SHALL 将请求转发到服务端接口并返回结果

### Requirement: 服务端 DataViews 结构解析
服务端系统 SHALL 能够解析 DataViews 结构，提取其中的媒体资源信息。

#### Scenario: 服务端解析 DataViews 结构
- **WHEN** 服务端接收到 DataViews 数据时
- **THEN** 服务端 SHALL 遍历数据结构，查找包含 mAsset 类型的单元格
- **THEN** 服务端 SHALL 提取其中的媒体资源路径和类型信息

### Requirement: ResourceInfo 接口
系统 SHALL 定义 ResourceInfo 接口以一致地表示资源信息，包括 DataViews 中的资源。

#### Scenario: 资源表示
- **WHEN** 处理 DataViews 中的资源时
- **THEN** 系统 SHALL 使用 ResourceInfo 接口表示这些资源
- **THEN** 接口 MUST 包含类型(type)、原始路径(originalPath)、资源键(resourceKey)和来源(source)字段