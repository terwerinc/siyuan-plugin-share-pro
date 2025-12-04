# 黑名单管理系统设计方案

## 1. 数据库设计（JPA Entity）

### ShareBlacklist 实体

```java
package space.terwer.sharepro.entity;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "share_blacklist", indexes = {
    @Index(name = "idx_author", columnList = "author"),
    @Index(name = "idx_type", columnList = "type")
})
public class ShareBlacklist {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    /**
     * 用户标识（作者邮箱）
     */
    @Column(nullable = false, length = 255)
    private String author;
    
    /**
     * 黑名单类型: NOTEBOOK(笔记本) 或 DOCUMENT(文档)
     */
    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private BlacklistType type;
    
    /**
     * 目标ID（笔记本ID或文档ID）
     */
    @Column(nullable = false, length = 100)
    private String targetId;
    
    /**
     * 目标名称（笔记本名称或文档标题）
     */
    @Column(nullable = false, length = 500)
    private String targetName;
    
    /**
     * 备注说明
     */
    @Column(length = 1000)
    private String note;
    
    /**
     * 创建时间
     */
    @Column(nullable = false)
    private LocalDateTime createdAt;
    
    /**
     * 更新时间
     */
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    
    // Getters and Setters
}

/**
 * 黑名单类型枚举
 */
public enum BlacklistType {
    NOTEBOOK,  // 笔记本
    DOCUMENT   // 文档
}
```

---

## 2. 服务端 API 接口设计

### 2.1 Controller

```java
package space.terwer.sharepro.controller;

import org.springframework.web.bind.annotation.*;
import space.terwer.sharepro.dto.*;

@RestController
@RequestMapping("/api/share/blacklist")
public class ShareBlacklistController {
    
    /**
     * 获取黑名单列表（分页）
     * GET /api/share/blacklist/list
     */
    @PostMapping("/list")
    public ResponseDTO<PageResponseDTO<BlacklistDTO>> listBlacklist(
        @RequestBody PageDTO<BlacklistDTO> page,
        @RequestHeader("Authorization") String token
    ) {
        // 实现
    }
    
    /**
     * 添加黑名单项
     * POST /api/share/blacklist/add
     */
    @PostMapping("/add")
    public ResponseDTO<BlacklistDTO> addBlacklist(
        @RequestBody AddBlacklistRequest request,
        @RequestHeader("Authorization") String token
    ) {
        // 实现
    }
    
    /**
     * 删除黑名单项
     * POST /api/share/blacklist/delete
     */
    @PostMapping("/delete")
    public ResponseDTO<Void> deleteBlacklist(
        @RequestBody DeleteBlacklistRequest request,
        @RequestHeader("Authorization") String token
    ) {
        // 实现
    }
    
    /**
     * 批量检查是否在黑名单中
     * POST /api/share/blacklist/check
     */
    @PostMapping("/check")
    public ResponseDTO<Map<String, Boolean>> checkBlacklist(
        @RequestBody CheckBlacklistRequest request,
        @RequestHeader("Authorization") String token
    ) {
        // 实现
    }
}
```

### 2.2 DTO 定义

```java
// BlacklistDTO.java
public class BlacklistDTO {
    private Long id;
    private String type;        // "NOTEBOOK" | "DOCUMENT"
    private String targetId;
    private String targetName;
    private String note;
    private String createdAt;   // ISO 8601 格式
    private String updatedAt;
}

// AddBlacklistRequest.java
public class AddBlacklistRequest {
    private String type;        // "NOTEBOOK" | "DOCUMENT"
    private String targetId;
    private String targetName;
    private String note;
}

// DeleteBlacklistRequest.java
public class DeleteBlacklistRequest {
    private Long id;            // 黑名单项ID
}

// CheckBlacklistRequest.java
public class CheckBlacklistRequest {
    private List<String> docIds;  // 需要检查的文档ID列表
}
```

### 2.3 Repository

```java
package space.terwer.sharepro.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import space.terwer.sharepro.entity.ShareBlacklist;

public interface ShareBlacklistRepository extends JpaRepository<ShareBlacklist, Long> {
    
    /**
     * 查询用户的黑名单列表（分页）
     */
    Page<ShareBlacklist> findByAuthor(String author, Pageable pageable);
    
    /**
     * 查询用户的黑名单列表（按类型，分页）
     */
    Page<ShareBlacklist> findByAuthorAndType(String author, BlacklistType type, Pageable pageable);
    
    /**
     * 检查是否存在
     */
    boolean existsByAuthorAndTargetId(String author, String targetId);
    
    /**
     * 查询用户的所有黑名单目标ID
     */
    List<String> findTargetIdByAuthor(String author);
    
    /**
     * 删除指定项
     */
    void deleteByIdAndAuthor(Long id, String author);
}
```

### 2.4 Service

```java
package space.terwer.sharepro.service;

@Service
public class ShareBlacklistService {
    
    @Autowired
    private ShareBlacklistRepository blacklistRepository;
    
    /**
     * 获取黑名单列表
     */
    public PageResponseDTO<BlacklistDTO> getBlacklistList(
        String author, 
        int pageNum, 
        int pageSize, 
        String type
    ) {
        // 实现分页查询
    }
    
    /**
     * 添加黑名单
     */
    public BlacklistDTO addBlacklist(String author, AddBlacklistRequest request) {
        // 检查是否已存在
        // 创建新记录
    }
    
    /**
     * 删除黑名单
     */
    public void deleteBlacklist(String author, Long id) {
        // 删除记录
    }
    
    /**
     * 批量检查黑名单
     */
    public Map<String, Boolean> checkBlacklist(String author, List<String> docIds) {
        List<String> blacklistedIds = blacklistRepository.findTargetIdByAuthor(author);
        Set<String> blacklistSet = new HashSet<>(blacklistedIds);
        
        Map<String, Boolean> result = new HashMap<>();
        for (String docId : docIds) {
            result.put(docId, blacklistSet.contains(docId));
        }
        return result;
    }
}
```

---

## 3. 前端类型定义

### TypeScript 类型

```typescript
// src/types/blacklist-api.d.ts

/**
 * 黑名单项 DTO（服务端返回）
 */
export interface BlacklistDTO {
  id: number
  type: "NOTEBOOK" | "DOCUMENT"
  targetId: string
  targetName: string
  note?: string
  createdAt: string  // ISO 8601
  updatedAt: string
}

/**
 * 添加黑名单请求
 */
export interface AddBlacklistRequest {
  type: "NOTEBOOK" | "DOCUMENT"
  targetId: string
  targetName: string
  note?: string
}

/**
 * 删除黑名单请求
 */
export interface DeleteBlacklistRequest {
  id: number
}

/**
 * 检查黑名单请求
 */
export interface CheckBlacklistRequest {
  docIds: string[]
}
```

---

## 4. 实施步骤

### 步骤 1: Java 后端实现
1. 创建 `ShareBlacklist` 实体
2. 创建 `ShareBlacklistRepository`
3. 创建 `ShareBlacklistService`
4. 创建 `ShareBlacklistController`
5. 测试 API

### 步骤 2: 前端实现
1. 创建类型定义
2. 封装 API 调用
3. 重构 UI 组件（修复宽度问题）
4. 集成到设置页面

---

## 5. API 使用示例

### 5.1 获取黑名单列表
```bash
curl -X POST 'http://localhost:8086/api/share/blacklist/list' \
  -H 'Authorization: YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"pageNum": 0, "pageSize": 10}'
```

### 5.2 添加黑名单
```bash
curl -X POST 'http://localhost:8086/api/share/blacklist/add' \
  -H 'Authorization: YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "DOCUMENT",
    "targetId": "20231201-abc123",
    "targetName": "测试文档",
    "note": "这是一个测试"
  }'
```

### 5.3 删除黑名单
```bash
curl -X POST 'http://localhost:8086/api/share/blacklist/delete' \
  -H 'Authorization: YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"id": 1}'
```

### 5.4 批量检查
```bash
curl -X POST 'http://localhost:8086/api/share/blacklist/check' \
  -H 'Authorization: YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "docIds": ["20231201-abc123", "20231202-def456"]
  }'
```

响应：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "20231201-abc123": true,
    "20231202-def456": false
  }
}
```
