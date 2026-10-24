# cs 产品测试样本

2026-10-25 已向服务器 `47.97.46.242` 的 `chunai_platform` 数据库添加测试样本：10 个产品、14 个 SKU、3 个分类。所有商品名、分类名和 SKU 编号均以 `cs` 开头。商品图片使用公开占位图，示例金额均为人民币分。

| 商品名称 | 初始状态 | SKU 数 | 初始实物库存合计 | 测试用途 |
|---|---|---:|---:|---|
| cs基础护理套装 | PUBLISHED | 2 | 150 | 多规格、不同价格、查询与修改 |
| cs便携湿巾 | PUBLISHED | 2 | 200 | 低价筛选和价格排序 |
| cs柔棉护理巾 | PUBLISHED | 1 | 60 | 单规格详情、修改名称、调整库存 |
| cs旅行收纳包 | PUBLISHED | 2 | 40 | 同价不同规格 |
| cs低库存体验装 | PUBLISHED | 1 | 1 | 库存不足、预占、取消与补货 |
| cs售罄补货样品 | PUBLISHED | 1 | 0 | 售罄展示、inStock=false |
| cs多规格组合样品 | PUBLISHED | 3 | 50 | 两个启用 SKU、一个停用 SKU |
| cs待上架测试商品 | DRAFT | 1 | 10 | 草稿编辑、发布、用户访问隔离 |
| cs已下架测试商品 | OFFLINE | 1 | 25 | 管理员查询、重新上架 |
| cs可删除草稿样品 | DRAFT | 0 | 0 | 直接删除，无 SKU、库存或订单引用 |

初始预占库存均为 0；商品与 SKU 初始 `version=1`。后续操作后请读取接口返回的最新版本，不能一直固定传 1。导入时同时写入 12 条非零库存的初始入库流水和商品创建审计记录。

## 查询与权限

公开查询：[GET /products?keyword=cs](http://47.97.46.242/api/v1/products?keyword=cs)。初始返回 7 个上架商品，包含 1 个售罄商品。`inStock=true` 初始返回 6 个，`inStock=false` 返回 1 个。

管理查询为 `GET /api/v1/admin/products?keyword=cs`，需要具备 `products:write` 的独立管理员令牌，初始可看到全部 10 个商品。普通用户不能查看草稿、下架商品和停用 SKU；普通用户令牌不能替代管理员令牌。

可删除样品 ID：`eac04038-bd24-487f-acfe-92fda8060eb9`。它没有 SKU，初始可调用：

```http
DELETE /api/v1/admin/products/eac04038-bd24-487f-acfe-92fda8060eb9?version=1
Authorization: Bearer <adminAccessToken>
```

带 SKU、库存流水或订单引用的产品／SKU 会按已有业务规则限制删除，可用这些样本检查 409 返回是否正常。[产品 CRUD 请求示例](../examples/product-samples.http) 已提供查询、新增、修改和删除请求。管理员初始化方法见 [交易后端说明](06-commerce.md#管理员初始化与权限)。

为满足图片记录的操作者外键，导入建立了 `cs_seed_operator` 技术记录，显示名以 `cs` 开头，账号为停用状态且没有权限，不提供登录密码。可登录的测试管理员需按管理流程单独初始化。

## 重复导入

样本定义：[cs-products.json](../database/seeds/cs-products.json)。手动导入脚本：[seed-products.cjs](../scripts/seed-products.cjs)。使用已配置数据库的本地 `.env`：

```powershell
npm.cmd run seed:products
```

脚本仅支持 development、test、staging 环境，需要提前运行数据库迁移。固定 UUID 保证重复执行不会重复新增；已存在的产品整组跳过，保留你修改的名称、状态、价格、库存和版本。已删除的固定样本会在下次执行时重新创建。脚本不会随迁移、启动或 CI 自动执行。

需要使用服务器配置时，可在项目目录执行已上传的脚本：

```bash
cd /opt/chunai/current
sudo env SEED_ENV_FILE=/etc/chunai/api.env \
  node /root/chunai-product-samples-20261025/seed-products.cjs \
  /root/chunai-product-samples-20261025/cs-products.json
```

脚本以事务写入，并使用数据库锁避免重复导入并发执行。不会重置或清空现有业务数据。所有输出仅包含样本数据与新增统计，不包含数据库密码。
