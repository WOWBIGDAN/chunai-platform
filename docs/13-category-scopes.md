# 商品、科普与课程分类

更新：2026-10-27。原“内容”分类作用域 `CONTENT` 已拆为 `SCIENCE`（科普）和 `COURSE`（课程）；商品保持 `PRODUCT`。创建、查询和响应中的 `scope` 均使用下面的值。

| scope | 中文含义 | 可绑定业务 |
|---|---|---|
| PRODUCT | 商品 | 商品及 SKU 的所属商品 |
| SCIENCE | 科普 | SCIENCE_ARTICLE（图文科普）、SCIENCE_VIDEO（视频科普） |
| COURSE | 课程 | ARTICLE_COURSE（图文课程）、VIDEO_COURSE（视频课程），包括免费、付费、会员课程 |

分类按业务用途区分，图文和视频通过内容 `kind` 区分。同一科普分类可以同时包含图文科普和视频科普，同一课程分类可以同时包含图文课程和视频课程。课程是否收费不改变其分类作用域。

## 查询和管理接口

下列路径省略 `/api/v1`。

| 接口 | 权限 | 说明 |
|---|---|---|
| `GET /categories?scope=PRODUCT` | 无需登录 | 已启用商品分类；省略 scope 默认 PRODUCT |
| `GET /categories?scope=SCIENCE` | 无需登录 | 已启用科普分类 |
| `GET /categories?scope=COURSE` | 无需登录 | 已启用课程分类 |
| `GET /admin/categories?scope=SCIENCE` | content:write | 管理端分类列表，包含停用项；可换其他 scope，省略时返回三类 |
| `GET /admin/categories/{id}` | content:write | 分类详情和版本 |
| `POST /admin/categories` | content:write | 创建指定作用域分类 |
| `PATCH /admin/categories/{id}` | content:write | 修改名称、父级、排序、启用状态，携带 version |
| `DELETE /admin/categories/{id}?version=N` | content:write | 删除无子分类、商品和内容引用的分类 |

分页、`keyword`、`parentId` 沿用现有约定：默认每页 20，最多 100；按 sortOrder、id 升序；parentId 只过滤直接子分类，省略时包含所有层级。三种作用域都允许创建同域父子分类。

创建科普分类：

```json
{"name":"健康知识","scope":"SCIENCE","sortOrder":0,"enabled":true}
```

创建课程子分类时，parentId 必须来自 COURSE：

```json
{"name":"入门课程","scope":"COURSE","parentId":"对应课程父分类的UUID","sortOrder":0,"enabled":true}
```

响应仍包含 `id/name/scope/parentId/sortOrder/enabled/version`。科普示例：

```json
{
  "id":"fedb46b4-eae6-44a8-8abd-1739bb089611",
  "name":"健康知识",
  "scope":"SCIENCE",
  "parentId":null,
  "sortOrder":0,
  "enabled":true,
  "version":1
}
```

`scope` 创建后不可修改；PATCH 传 scope 返回 400。父子跨域返回 409 `CATEGORY_SCOPE_MISMATCH`，循环返回 409 `CATEGORY_CYCLE`。分类存在业务引用或子分类时删除返回 409 `RESOURCE_IN_USE`。管理端分类写操作不需要 Idempotency-Key，修改和删除必须使用最新 version。

## 与业务的关系

- 创建、修改和发布科普内容，只能关联已启用的 SCIENCE 分类；课程只能关联已启用的 COURSE 分类。类型不符或分类停用返回 409 `CATEGORY_UNAVAILABLE`。商品仍只关联 PRODUCT。
- 公开图文、视频列表会同时校验内容 kind 与分类 scope；普通用户不能通过分类 ID 读取错误作用域内容。管理员仍可读取草稿用于维护。
- 停用分类会使其当前公开内容不可见，相关收藏保留但标记失效；重新启用恢复。科普和课程分类分别控制，不会因停用科普分类而同时停用课程分类。启停针对该分类自身，不自动修改子分类的 enabled。
- 课程试算、下单、付款授予新权益都重新检查 COURSE 分类。已有独立购买权益继续沿用原有下架课程访问规则，迁移不删除订单或购买权益。
- 专栏仍可分组科普和课程，不授予访问权益；这次拆分不改变专栏的数据结构。

## 旧客户端与数据库迁移

旧 `GET /categories?scope=CONTENT`、`GET /admin/categories?scope=CONTENT`、创建 `scope=CONTENT` 均返回 400 `VALIDATION_ERROR`，不能继续把科普和课程作为一个筛选值。前端应根据当前编辑/浏览的内容 kind 选择 SCIENCE 或 COURSE，并从该域重新加载分类选项。

已有内容、商品、专栏和订单接口路径保持原样；内容接口请求中的 categoryId 需要满足上面的匹配规则。会员权益编码 `MEMBER_CONTENT`、素材用途 `CONTENT_COVER/CONTENT_VIDEO/CONTENT_BODY_IMAGE` 继续沿用原名称，它们不是分类作用域。

迁移为 `SplitContentCategories1793404800000`，发布前备份数据库，再执行正常 TypeORM 迁移：

1. 原 CONTENT 分类保留原 ID、名称、父子关系，改为 SCIENCE，版本递增。
2. 为每个旧分类复制一份 COURSE 分类，保留名称、排序、enabled；课程父级引用对应复制后的父级。新 ID 由旧 ID 确定，重试不会重复复制。
3. 原图文/视频课程改绑 COURSE 分类并增加内容版本；科普保留原分类 ID。
4. PRODUCT 分类、内容正文、视频来源、专栏、订单和购买权益不变；不插入任何示例内容或订单。
5. 数据迁移在事务中完成，并验证分类匹配；随后增加 scope 的数据库 CHECK 约束和查询索引。DDL 中断可以重试。

已有库无需重建表。可使用 `npm run migration:run`，生产构建使用 `npm run migration:run:prod`。未来编辑产生的新分类数据不能用简单 down 合并回旧域，恢复应使用已核对的备份。

自动化检查覆盖三域查询、旧值拒绝、同域层级、跨域创建/修改拒绝、科普/课程绑定、公开访问、收藏、课程购买及混用旧分类的迁移重入。请求示例见 [category-scopes.http](../examples/category-scopes.http)，完整字段见 [接口文档](01-api-reference.md)。
