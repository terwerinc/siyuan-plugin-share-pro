# 黑名单管理 - Java 后端实现指南

## 完整实现代码

### 1. Entity - ShareBlacklist.java

```java
package space.terwer.sharepro.entity;

import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "share_blacklist", indexes = {
    @Index(name = "idx_author", columnList = "author"),
    @Index(name = "idx_target_id", columnList = "targetId"),
    @Index(name = "idx_type", columnList = "type")
})
public class ShareBlacklist {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 255)
    private String author;
    
    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private BlacklistType type;
    
    @Column(nullable = false, length = 100)
    private String targetId;
    
    @Column(nullable = false, length = 500)
    private String targetName;
    
    @Column(length = 1000)
    private String note;
    
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

public enum BlacklistType {
    NOTEBOOK,
    DOCUMENT
}
```

### 2. Repository - ShareBlacklistRepository.java

```java
package space.terwer.sharepro.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import space.terwer.sharepro.entity.ShareBlacklist;
import space.terwer.sharepro.entity.BlacklistType;

import java.util.List;

public interface ShareBlacklistRepository extends JpaRepository<ShareBlacklist, Long> {
    
    Page<ShareBlacklist> findByAuthor(String author, Pageable pageable);
    
    Page<ShareBlacklist> findByAuthorAndType(String author, BlacklistType type, Pageable pageable);
    
    boolean existsByAuthorAndTargetId(String author, String targetId);
    
    @Query("SELECT b.targetId FROM ShareBlacklist b WHERE b.author = :author")
    List<String> findTargetIdsByAuthor(@Param("author") String author);
    
    void deleteByIdAndAuthor(Long id, String author);
}
```

### 3. DTO - BlacklistDTO.java

```java
package space.terwer.sharepro.dto;

import lombok.Data;

@Data
public class BlacklistDTO {
    private Long id;
    private String type;
    private String targetId;
    private String targetName;
    private String note;
    private String createdAt;
    private String updatedAt;
}
```

### 4. Request DTOs

```java
// AddBlacklistRequest.java
package space.terwer.sharepro.dto;

import lombok.Data;

@Data
public class AddBlacklistRequest {
    private String type;
    private String targetId;
    private String targetName;
    private String note;
}

// DeleteBlacklistRequest.java
package space.terwer.sharepro.dto;

import lombok.Data;

@Data
public class DeleteBlacklistRequest {
    private Long id;
}

// CheckBlacklistRequest.java
package space.terwer.sharepro.dto;

import lombok.Data;
import java.util.List;

@Data
public class CheckBlacklistRequest {
    private List<String> docIds;
}
```

### 5. Service - ShareBlacklistService.java

```java
package space.terwer.sharepro.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import space.terwer.sharepro.dto.*;
import space.terwer.sharepro.entity.BlacklistType;
import space.terwer.sharepro.entity.ShareBlacklist;
import space.terwer.sharepro.repository.ShareBlacklistRepository;

import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class ShareBlacklistService {
    
    @Autowired
    private ShareBlacklistRepository blacklistRepository;
    
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ISO_DATE_TIME;
    
    /**
     * 获取黑名单列表（分页）
     */
    public PageResponseDTO<BlacklistDTO> getBlacklistList(
        String author, 
        int pageNum, 
        int pageSize, 
        String type
    ) {
        Pageable pageable = PageRequest.of(pageNum, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        
        Page<ShareBlacklist> page;
        if (type != null && !type.isEmpty()) {
            BlacklistType blacklistType = BlacklistType.valueOf(type);
            page = blacklistRepository.findByAuthorAndType(author, blacklistType, pageable);
        } else {
            page = blacklistRepository.findByAuthor(author, pageable);
        }
        
        List<BlacklistDTO> data = new ArrayList<>();
        for (ShareBlacklist entity : page.getContent()) {
            data.add(toDTO(entity));
        }
        
        PageResponseDTO<BlacklistDTO> response = new PageResponseDTO<>();
        response.setData(data);
        response.setTotal((int) page.getTotalElements());
        response.setPageNum(pageNum);
        response.setPageSize(pageSize);
        response.setTotalPages(page.getTotalPages());
        
        return response;
    }
    
    /**
     * 添加黑名单
     */
    @Transactional
    public BlacklistDTO addBlacklist(String author, AddBlacklistRequest request) {
        // 检查是否已存在
        if (blacklistRepository.existsByAuthorAndTargetId(author, request.getTargetId())) {
            throw new RuntimeException("该项已在黑名单中");
        }
        
        ShareBlacklist entity = new ShareBlacklist();
        entity.setAuthor(author);
        entity.setType(BlacklistType.valueOf(request.getType()));
        entity.setTargetId(request.getTargetId());
        entity.setTargetName(request.getTargetName());
        entity.setNote(request.getNote());
        
        ShareBlacklist saved = blacklistRepository.save(entity);
        return toDTO(saved);
    }
    
    /**
     * 删除黑名单
     */
    @Transactional
    public void deleteBlacklist(String author, Long id) {
        blacklistRepository.deleteByIdAndAuthor(id, author);
    }
    
    /**
     * 批量检查黑名单
     */
    public Map<String, Boolean> checkBlacklist(String author, List<String> docIds) {
        List<String> blacklistedIds = blacklistRepository.findTargetIdsByAuthor(author);
        Set<String> blacklistSet = new HashSet<>(blacklistedIds);
        
        Map<String, Boolean> result = new HashMap<>();
        for (String docId : docIds) {
            result.put(docId, blacklistSet.contains(docId));
        }
        return result;
    }
    
    /**
     * Entity 转 DTO
     */
    private BlacklistDTO toDTO(ShareBlacklist entity) {
        BlacklistDTO dto = new BlacklistDTO();
        dto.setId(entity.getId());
        dto.setType(entity.getType().name());
        dto.setTargetId(entity.getTargetId());
        dto.setTargetName(entity.getTargetName());
        dto.setNote(entity.getNote());
        dto.setCreatedAt(entity.getCreatedAt().format(FORMATTER));
        dto.setUpdatedAt(entity.getUpdatedAt().format(FORMATTER));
        return dto;
    }
}
```

### 6. Controller - ShareBlacklistController.java

```java
package space.terwer.sharepro.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import space.terwer.sharepro.dto.*;
import space.terwer.sharepro.service.ShareBlacklistService;
import space.terwer.sharepro.util.JwtUtil;

import java.util.Map;

@RestController
@RequestMapping("/api/share/blacklist")
public class ShareBlacklistController {
    
    @Autowired
    private ShareBlacklistService blacklistService;
    
    @Autowired
    private JwtUtil jwtUtil;
    
    /**
     * 获取黑名单列表（分页）
     */
    @PostMapping("/list")
    public ResponseDTO<PageResponseDTO<BlacklistDTO>> listBlacklist(
        @RequestBody PageDTO<BlacklistDTO> page,
        @RequestHeader("Authorization") String token
    ) {
        String author = jwtUtil.getUsernameFromToken(token);
        
        PageResponseDTO<BlacklistDTO> data = blacklistService.getBlacklistList(
            author,
            page.getPageNum(),
            page.getPageSize(),
            page.getSearch()  // 可选：类型过滤
        );
        
        return ResponseDTO.success("获取成功", data);
    }
    
    /**
     * 添加黑名单
     */
    @PostMapping("/add")
    public ResponseDTO<BlacklistDTO> addBlacklist(
        @RequestBody AddBlacklistRequest request,
        @RequestHeader("Authorization") String token
    ) {
        String author = jwtUtil.getUsernameFromToken(token);
        
        try {
            BlacklistDTO data = blacklistService.addBlacklist(author, request);
            return ResponseDTO.success("添加成功", data);
        } catch (Exception e) {
            return ResponseDTO.error(e.getMessage());
        }
    }
    
    /**
     * 删除黑名单
     */
    @PostMapping("/delete")
    public ResponseDTO<Void> deleteBlacklist(
        @RequestBody DeleteBlacklistRequest request,
        @RequestHeader("Authorization") String token
    ) {
        String author = jwtUtil.getUsernameFromToken(token);
        
        try {
            blacklistService.deleteBlacklist(author, request.getId());
            return ResponseDTO.success("删除成功", null);
        } catch (Exception e) {
            return ResponseDTO.error(e.getMessage());
        }
    }
    
    /**
     * 批量检查黑名单
     */
    @PostMapping("/check")
    public ResponseDTO<Map<String, Boolean>> checkBlacklist(
        @RequestBody CheckBlacklistRequest request,
        @RequestHeader("Authorization") String token
    ) {
        String author = jwtUtil.getUsernameFromToken(token);
        
        Map<String, Boolean> data = blacklistService.checkBlacklist(author, request.getDocIds());
        return ResponseDTO.success("检查成功", data);
    }
}
```

---

## 数据库迁移 SQL

```sql
CREATE TABLE `share_blacklist` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `author` VARCHAR(255) NOT NULL COMMENT '用户标识（邮箱）',
  `type` VARCHAR(20) NOT NULL COMMENT '类型：NOTEBOOK/DOCUMENT',
  `target_id` VARCHAR(100) NOT NULL COMMENT '目标ID',
  `target_name` VARCHAR(500) NOT NULL COMMENT '目标名称',
  `note` VARCHAR(1000) DEFAULT NULL COMMENT '备注',
  `created_at` DATETIME NOT NULL COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_author` (`author`),
  KEY `idx_target_id` (`target_id`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分享黑名单表';
```

---

## Maven 依赖

```xml
<!-- Spring Data JPA -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>

<!-- Lombok (可选，简化代码) -->
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <optional>true</optional>
</dependency>
```

---

## 测试说明

### 1. 添加黑名单
```bash
curl -X POST 'http://localhost:8086/api/share/blacklist/add' \
  -H 'Authorization: YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "DOCUMENT",
    "targetId": "20231201-test001",
    "targetName": "测试文档",
    "note": "用于测试的文档"
  }'
```

### 2. 获取黑名单列表
```bash
curl -X POST 'http://localhost:8086/api/share/blacklist/list' \
  -H 'Authorization: YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "pageNum": 0,
    "pageSize": 10,
    "search": ""
  }'
```

### 3. 删除黑名单
```bash
curl -X POST 'http://localhost:8086/api/share/blacklist/delete' \
  -H 'Authorization: YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"id": 1}'
```

### 4. 批量检查
```bash
curl -X POST 'http://localhost:8086/api/share/blacklist/check' \
  -H 'Authorization: YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "docIds": ["20231201-test001", "20231202-test002"]
  }'
```
