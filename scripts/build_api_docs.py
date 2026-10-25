"""Build the Chinese integration documents and OpenAPI contract (stdlib only)."""
from __future__ import annotations

import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
SCHEMAS: dict = {}
OPERATIONS: list[dict] = []
IMPLEMENTED = {
    ('get', '/health'),
    ('get', '/public/legal-documents/{type}'),
    ('post', '/auth/register'), ('post', '/auth/login/password'),
    ('post', '/auth/refresh'), ('post', '/auth/logout'),
    ('get', '/me'), ('put', '/me/password'),
    ('get', '/me/sessions'), ('delete', '/me/sessions/{id}'),
}
DEFERRED = {'/auth/sms-codes', '/auth/login/sms', '/auth/password/reset'}


def implementation_status(operation):
    if (operation['method'], operation['path']) in IMPLEMENTED:
        return 'implemented'
    return 'deferred' if operation['path'] in DEFERRED else 'planned'


def string(desc, example=None, **kw):
    result = {"type": "string", "description": desc, **kw}
    if example is not None:
        result["example"] = example
    return result


def enum(desc, values, example=None):
    values = values.split("|")
    return string(desc, example or values[0], enum=values)


def integer(desc, example=0, minimum=0, **kw):
    return {"type": "integer", "description": desc, "minimum": minimum, "example": example, **kw}


def boolean(desc, example=False):
    return {"type": "boolean", "description": desc, "example": example}


def ref(name):
    return {"$ref": f"#/components/schemas/{name}"}


def array(item, desc, **kw):
    return {"type": "array", "items": ref(item) if isinstance(item, str) else item,
            "description": desc, **kw}


def obj(name, desc, fields, required=None, **kw):
    SCHEMAS[name] = {"type": "object", "description": desc,
                     "additionalProperties": False, "properties": copy.deepcopy(fields),
                     "required": list(fields) if required is None else required, **kw}
    if not SCHEMAS[name]["required"]:
        del SCHEMAS[name]["required"]
    return ref(name)


def union(name, desc, variants, discriminator=None):
    SCHEMAS[name] = {"description": desc, "oneOf": [ref(v) for v in variants]}
    if discriminator:
        SCHEMAS[name]["discriminator"] = {"propertyName": discriminator, "mapping": {
            SCHEMAS[v]["properties"][discriminator]["enum"][0]: f"#/components/schemas/{v}"
            for v in variants}}


def page(name):
    target = f"Page{name}"
    if target not in SCHEMAS:
        obj(target, f"{name} 的分页结果。固定按白名单排序；同值用 id 排序。", {
            "items": array(name, "当前页数据；空页为 []"),
            "total": integer("匹配记录总数", 1),
            "page": integer("页码，从 1 开始", 1, 1),
            "pageSize": integer("每页条数", 20, 1, maximum=100),
            "hasNext": boolean("是否有下一页")})
    return target


ID = string("不透明业务 ID；前端必须按字符串保存。", "id_10001", minLength=1,
            maxLength=64, pattern=r"^[A-Za-z0-9_-]{1,64}$")
TIME = string("UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。", "2026-10-22T02:00:00Z", format="date-time")
NULL_TIME = {**TIME, "nullable": True, "description": "UTC 时间；未发生时为 null。"}
MONEY = integer("金额，单位为人民币分；由服务端计算，禁止浮点。", 9900, 0, maximum=9007199254740991)
PHONE = string("E.164 手机号；默认支持 +86，其他地区由短信配置决定。", "+8613800000000", pattern=r"^\+[1-9]\d{7,14}$")
URI = string("HTTPS URL。", "https://cdn.example.com/cover.jpg", format="uri")
TEXT = string("文本。", "示例内容", maxLength=2000)
VERSION = integer("乐观锁版本；写操作必须提交最近读取的版本。", 1, 1)
QTY = integer("件数。", 1, 1, maximum=99)
CONTENT_KIND = enum("内容类型；课程由章节组成。", "SCIENCE_VIDEO|SCIENCE_ARTICLE|VIDEO_COURSE|ARTICLE_COURSE")
PUBLISH = enum("发布状态。", "DRAFT|PUBLISHED|OFFLINE")
ACCESS = enum("访问策略：免费／单独购买／会员或购买。", "FREE|PURCHASE|MEMBER_OR_PURCHASE")
ORDER_TYPE = enum("一种订单只允许一种业务类型。", "PRODUCT|COURSE|MEMBERSHIP")
ORDER_STATUS = enum("履约状态；支付与售后另有独立字段。", "PENDING_PAYMENT|PENDING_SHIPMENT|PENDING_RECEIPT|COMPLETED|CANCELLED|CLOSED")
PAYMENT_STATUS = enum("订单汇总支付状态。", "UNPAID|PAID|PARTIALLY_REFUNDED|REFUNDED")
AFTERSALE_STATUS = enum("售后状态。", "PENDING_REVIEW|AWAITING_RETURN|RETURNING|REFUNDING|REFUND_FAILED|COMPLETED|REJECTED|CANCELLED|CLOSED")
MEDIA_STATUS = enum("上传后处理完成才可引用。", "UPLOADING|PROCESSING|READY|FAILED")

obj("ActionResult", "无业务对象的操作结果。", {"success": boolean("操作是否完成。", True)})
obj("FieldError", "参数校验错误。", {"field": string("字段路径。", "items[0].quantity"), "reason": string("原因。", "必须大于等于 1")})
obj("ApiError", "错误详情；不返回堆栈、数据库或密钥信息。", {
    "details": array("FieldError", "参数错误列表；非参数错误为 []"),
    "retryAfterSeconds": integer("可选：建议重试等待秒数。", 60, 0)}, ["details"])
obj("ErrorResponse", "失败响应；HTTP 状态与业务错误码同时有意义。", {
    "code": string("稳定的业务错误码。", "VALIDATION_ERROR"),
    "message": string("可读提示；前端逻辑依据 code。", "请求参数不合法"),
    "data": {"type": "object", "nullable": True, "enum": [None], "description": "失败固定为 null。"},
    "error": ref("ApiError"), "requestId": string("请求追踪号。", "req_demo_001"), "timestamp": TIME})
obj("MediaSummary", "附件或媒体元数据；不含私有源文件地址。", {
    "id": ID, "kind": enum("媒体类型。", "IMAGE|VIDEO"), "status": MEDIA_STATUS,
    "mimeType": string("实际检查后的 MIME。", "image/jpeg"), "sizeBytes": integer("字节数。", 102400),
    "publicUrl": {**URI, "nullable": True, "description": "仅公开图片有 URL；私有视频或售后凭证为 null。"},
    "durationSeconds": integer("仅视频返回，处理前可不返回。", 180)},
    ["id", "kind", "status", "mimeType", "sizeBytes", "publicUrl"])
obj("MembershipSummary", "会员状态以服务端当前时间判定，不依赖前端缓存。", {
    "active": boolean("当前是否为有效会员。", True),
    "expiresAt": NULL_TIME, "benefitCodes": array(string("权益编码。", "MEMBER_COURSES"), "当前权益；过期为 []")})
obj("UserSummary", "用户自身资料；手机号脱敏。", {
    "id": ID, "nickname": string("昵称。", "小雨", minLength=1, maxLength=32),
    "avatarUrl": {**URI, "nullable": True}, "phoneMasked": string("脱敏手机。", "138****0000"),
    "status": enum("账号状态。", "ACTIVE|BANNED|DEACTIVATED"),
    "membership": ref("MembershipSummary"), "createdAt": TIME})
obj("AuthTokens", "客户端会话；只在客户端鉴权响应中返回。", {
    "accessToken": string("JWT，aud=client；建议 15 分钟。", "eyJ...client.access"),
    "accessExpiresInSeconds": integer("accessToken 有效秒数。", 900, 1),
    "refreshToken": string("不透明随机令牌，每次使用轮换；建议最长 30 天。", "rt_client_example"),
    "refreshExpiresAt": TIME, "tokenType": enum("认证方案。", "Bearer"), "user": ref("UserSummary")})
obj("SmsRequest", "短信发送请求；IP、手机号、设备维度限流，避免账号枚举。", {
    "phone": PHONE, "purpose": enum("验证码用途，互不通用。", "REGISTER|LOGIN|RESET_PASSWORD"),
    "captchaToken": string("由已选人机校验服务签发。", "captcha_demo", minLength=1, maxLength=2048)})
obj("SmsChallenge", "无论手机号是否注册，都返回相同形状。", {
    "challengeId": ID, "expiresInSeconds": integer("验证码有效期。", 300, 1),
    "retryAfterSeconds": integer("再次发送间隔。", 60, 1)})
obj("RegisterInput", "注册后直接签发客户端会话。当前不需要手机验证码，不接收 challengeId、smsCode；手机号仅作未验证的登录账号。", {
    "phone": PHONE, "password": string("密码；不记录明文。", "Example#Password9", minLength=10, maxLength=72),
    "nickname": string("可选昵称。", "小雨", minLength=1, maxLength=32),
    "termsVersion": string("用户确认的协议版本。", "2026-10-01", minLength=1, maxLength=64),
    "privacyVersion": string("用户确认的隐私政策版本。", "2026-10-01", minLength=1, maxLength=64)},
    ["phone", "password", "termsVersion", "privacyVersion"])
obj("PasswordLoginInput", "密码登录；账号不存在与密码错误使用同一错误。", {
    "phone": PHONE, "password": string("原始密码。", "Example#Password9", minLength=1, maxLength=72)})
obj("SmsLoginInput", "只登录已注册用户；不会静默注册。", {
    "phone": PHONE, "challengeId": ID, "smsCode": string("LOGIN 验证码。", "123456", pattern=r"^\d{6}$")})
obj("RefreshInput", "必须使用对应 audience 的最新 refreshToken；旧令牌重放撤销该会话链。", {
    "refreshToken": string("当前刷新令牌。", "rt_client_example", minLength=16, maxLength=1024)})
obj("PasswordResetInput", "重置成功后撤销用户全部会话。", {
    "phone": PHONE, "challengeId": ID, "smsCode": string("RESET_PASSWORD 验证码。", "123456", pattern=r"^\d{6}$"),
    "newPassword": string("新密码。", "New#Password123", minLength=10, maxLength=72)})
obj("UserPatch", "修改本人资料。未传保持；avatarMediaId=null 清空头像。", {
    "nickname": string("昵称。", "小雨", minLength=1, maxLength=32),
    "avatarMediaId": {**ID, "nullable": True, "description": "本人上传且用途为 AVATAR 的 READY 图片。"}}, [], minProperties=1)
obj("PasswordChangeInput", "修改后撤销全部会话，客户端重新登录。", {
    "currentPassword": string("旧密码。", "Example#Password9", minLength=1, maxLength=72),
    "newPassword": string("新密码。", "New#Password123", minLength=10, maxLength=72)})
obj("Session", "当前客户端设备会话。", {"id": ID, "deviceLabel": string("服务端解析的设备信息。", "Chrome / Windows"),
    "isCurrent": boolean("当前会话。", True), "lastActiveAt": TIME, "createdAt": TIME})
obj("AdminPrincipal", "管理员与客户使用独立账号体系及 token audience。", {
    "id": ID, "username": string("管理员名。", "content_manager"),
    "displayName": string("显示名。", "内容管理员"),
    "permissions": array(string("权限编码。", "content:write"), "服务端有效权限列表")})
obj("AdminLoginInput", "管理员账号由运维初始化；客户端注册不能创建管理员。", {
    "username": string("管理员账号。", "admin", minLength=1, maxLength=64),
    "password": string("密码。", "Admin#Password123", minLength=1, maxLength=72)})
obj("AdminAuthTokens", "管理员会话；accessToken aud=admin。", {
    "accessToken": string("管理员 JWT。", "eyJ...admin.access"),
    "accessExpiresInSeconds": integer("有效秒数。", 900, 1),
    "refreshToken": string("轮换刷新令牌。", "rt_admin_example"), "refreshExpiresAt": TIME,
    "tokenType": enum("认证方案。", "Bearer"), "admin": ref("AdminPrincipal")})

obj("Category", "内容或产品分类；禁止跨 scope 使用或产生父子循环。", {
    "id": ID, "name": string("分类名。", "健康科普", minLength=1, maxLength=32),
    "scope": enum("分类作用域。", "CONTENT|PRODUCT"), "parentId": {**ID, "nullable": True},
    "sortOrder": integer("升序展示。", 0), "enabled": boolean("是否可用。", True), "version": VERSION})
obj("CategoryCreate", "创建分类。", {
    "name": string("名称。", "健康科普", minLength=1, maxLength=32), "scope": enum("作用域。", "CONTENT|PRODUCT"),
    "parentId": {**ID, "nullable": True}, "sortOrder": integer("排序。", 0), "enabled": boolean("启用。", True)}, ["name", "scope"])
obj("CategoryPatch", "scope 不可修改；有子分类或引用时不可删除。", {
    "name": string("名称。", "健康知识", minLength=1, maxLength=32), "parentId": {**ID, "nullable": True},
    "sortOrder": integer("排序。", 0), "enabled": boolean("启用。", True), "version": VERSION}, ["version"], minProperties=2)
obj("ContentSummary", "视频、图文及课程统一的公开摘要；无受保护正文和视频源地址。", {
    "id": ID, "kind": CONTENT_KIND, "title": string("标题。", "认识身体与健康", minLength=1, maxLength=120),
    "summary": string("简介。", "以科学知识解答常见问题。", maxLength=2000), "cover": ref("MediaSummary"),
    "category": ref("Category"), "tags": array(string("标签。", "基础知识", maxLength=20), "标签", maxItems=10),
    "accessPolicy": ACCESS, "priceCents": MONEY, "currency": enum("币种。", "CNY"),
    "chapterCount": integer("科普为 0；课程为已发布章节数。", 0),
    "publishedAt": TIME})
obj("AccessDecision", "当前请求者的访问判定；权益要在获取正文或播放授权时再次验证。", {
    "canAccess": boolean("是否可访问完整内容。", True),
    "reason": enum("授权原因或阻断原因；ADMIN 仅管理端。", "FREE|PURCHASED|MEMBER|PREVIEW|ADMIN|LOGIN_REQUIRED|PURCHASE_REQUIRED|CONTENT_UNAVAILABLE")})
obj("ContentDetail", "公开详情，付费正文与视频地址通过独立接口获取。", {
    **SCHEMAS["ContentSummary"]["properties"], "descriptionHtml": string("经服务端清洗的介绍 HTML。", "<p>课程介绍</p>", maxLength=100000),
    "authorName": string("作者／讲师显示名。", "健康教育团队", maxLength=64),
    "columnIds": array(ID, "所属专栏 ID"), "access": ref("AccessDecision")})
obj("ArticleBody", "仅通过授权校验后返回的图文正文。", {
    "contentId": ID, "bodyHtml": string("已清洗 HTML；前端仍使用受控渲染。", "<p>科普正文示例</p>", maxLength=500000),
    "imageUrls": array(URI, "正文使用的公开图片 URL")})
obj("PlaybackGrant", "短时播放授权；不可持久化为内容源地址。", {
    "contentId": ID, "chapterId": {**ID, "nullable": True}, "playbackUrl": {**URI, "example": "https://media.example.com/play.m3u8?token=demo"},
    "expiresAt": TIME, "durationSeconds": integer("可播放时长。", 180),
    "preview": boolean("是否为服务端限制的独立预览片段。")})
obj("ChapterSummary", "课程目录；锁定章节也可展示摘要。", {
    "id": ID, "courseId": ID, "title": string("章节标题。", "第一章：基础知识", minLength=1, maxLength=120),
    "kind": enum("章节类型必须匹配课程类型。", "VIDEO|ARTICLE"), "sortOrder": integer("课程内排序。", 1),
    "isPreview": boolean("是否免费预览。", True), "durationSeconds": integer("视频时长；图文为 0。", 180),
    "access": ref("AccessDecision")})
obj("Column", "专栏用于组织内容，本身不售卖，不自动授予内容权限。", {
    "id": ID, "name": string("专栏名。", "亲密关系与健康", minLength=1, maxLength=64),
    "description": string("说明。", "专题知识合集", maxLength=2000), "cover": ref("MediaSummary"),
    "contentCount": integer("已发布内容数量。", 5), "sortOrder": integer("排序。", 0)})
obj("ColumnCreate", "创建专栏，默认 DRAFT。", {
    "name": string("名称。", "亲密关系与健康", minLength=1, maxLength=64), "description": TEXT,
    "coverMediaId": ID, "sortOrder": integer("排序。", 0)}, ["name", "coverMediaId"])
obj("ColumnPatch", "修改专栏资料。", {**SCHEMAS["ColumnCreate"]["properties"], "version": VERSION}, ["version"], minProperties=2)
obj("AdminColumn", "管理端专栏资料。", {**SCHEMAS["Column"]["properties"], "status": PUBLISH,
    "version": VERSION, "createdAt": TIME, "updatedAt": TIME})
obj("ColumnContentInput", "幂等设置单个内容在专栏中的位置；同值按关联 ID 排序。", {"sortOrder": integer("排序。", 1)})
obj("ContentCreate", "创建内容草稿；kind 不可修改；科普必须 FREE、priceCents=0。", {
    "kind": CONTENT_KIND, "title": string("标题。", "认识身体与健康", minLength=1, maxLength=120),
    "summary": TEXT, "descriptionHtml": string("介绍 HTML；服务端清洗。", "<p>内容介绍</p>", maxLength=100000),
    "coverMediaId": ID, "categoryId": ID, "authorName": string("作者。", "健康教育团队", maxLength=64),
    "tags": array(string("标签。", "基础知识", maxLength=20), "标签", maxItems=10, uniqueItems=True),
    "accessPolicy": ACCESS, "priceCents": MONEY},
    ["kind", "title", "summary", "coverMediaId", "categoryId", "accessPolicy", "priceCents"])
obj("ContentPatch", "部分更新；accessPolicy 与 priceCents 改动需同时提交；发布内容即时生效并留审计。", {
    **{k: v for k, v in SCHEMAS["ContentCreate"]["properties"].items() if k != "kind"}, "version": VERSION}, ["version"], minProperties=2)
obj("AdminContent", "管理端内容详情，不直接携带媒体源。", {
    **SCHEMAS["ContentDetail"]["properties"], "status": PUBLISH, "version": VERSION,
    "createdAt": TIME, "updatedAt": TIME})
obj("VersionInput", "校验资源版本，防止覆盖其他管理员修改。", {"version": VERSION})
obj("ScienceBodyInput", "科普正文二选一：图文传 bodyHtml+imageMediaIds；视频传 videoMediaId。额外字段拒绝。", {
    "version": VERSION, "bodyHtml": string("图文必填且非空。", "<p>科普正文</p>", minLength=1, maxLength=500000),
    "imageMediaIds": array(ID, "图文使用的 READY 图片；无图片传 []", maxItems=100, uniqueItems=True),
    "videoMediaId": ID}, ["version"])
obj("AdminBody", "管理员读取已保存正文或媒体引用；非适用字段固定为 null。", {
    "bodyHtml": {**TEXT, "nullable": True}, "imageMediaIds": array(ID, "正文图片 ID"),
    "videoMediaId": {**ID, "nullable": True}, "version": VERSION})
obj("ChapterCreate", "创建章节草稿；章节 kind 从课程继承。", {
    "title": string("标题。", "第一章", minLength=1, maxLength=120), "sortOrder": integer("排序。", 1),
    "isPreview": boolean("免费预览整章；完整预览章需单独配置。", False)}, ["title", "sortOrder"])
obj("ChapterPatch", "修改章节元信息。", {**SCHEMAS["ChapterCreate"]["properties"], "version": VERSION}, ["version"], minProperties=2)
obj("AdminChapter", "管理员章节详情。", {**SCHEMAS["ChapterSummary"]["properties"], "status": PUBLISH,
    "version": VERSION, "createdAt": TIME, "updatedAt": TIME})

# Products, purchasing, payments and fulfilment.
obj("SkuAttribute", "SKU 的规格维度。", {"name": string("维度名。", "规格", maxLength=32), "value": string("取值。", "标准装", maxLength=64)})
obj("ProductSummary", "公开产品摘要；只包含上架产品和可售 SKU。", {
    "id": ID, "name": string("产品名。", "健康护理用品", minLength=1, maxLength=120), "summary": TEXT,
    "cover": ref("MediaSummary"), "category": ref("Category"),
    "minPriceCents": MONEY, "maxPriceCents": MONEY, "currency": enum("币种。", "CNY"),
    "inStock": boolean("至少一个可售 SKU 有可用库存。", True)})
obj("Sku", "公开 SKU；服务端创建订单时重新检查库存。", {
    "id": ID, "productId": ID, "skuCode": string("商家 SKU 编号，全局唯一。", "CARE-001", maxLength=64),
    "attributes": array("SkuAttribute", "规格列表", maxItems=10), "priceCents": MONEY,
    "availableStock": integer("可用库存 = 实物库存 - 预占库存。", 100), "enabled": boolean("可售。", True)})
obj("ProductDetail", "产品详情。", {**SCHEMAS["ProductSummary"]["properties"],
    "detailHtml": string("已清洗的详情 HTML。", "<p>产品使用说明</p>", maxLength=100000),
    "gallery": array("MediaSummary", "图片列表"), "skus": array("Sku", "可售 SKU"),
    "afterSalePolicy": string("售后政策展示文本；实际申请资格以服务端为准。", "符合平台售后规则可申请售后。")})
obj("ProductCreate", "创建产品草稿；至少有一个启用 SKU 才可发布。", {
    "name": string("产品名。", "健康护理用品", minLength=1, maxLength=120), "summary": TEXT,
    "coverMediaId": ID, "categoryId": ID, "detailHtml": string("详情 HTML。", "<p>产品说明</p>", maxLength=100000),
    "galleryMediaIds": array(ID, "READY 图片", maxItems=20, uniqueItems=True), "afterSalePolicy": TEXT},
    ["name", "summary", "coverMediaId", "categoryId", "detailHtml", "afterSalePolicy"])
obj("ProductPatch", "修改产品资料；库存走单独调整接口。", {**SCHEMAS["ProductCreate"]["properties"], "version": VERSION}, ["version"], minProperties=2)
obj("AdminProduct", "管理端产品详情；含停用 SKU。", {
    **SCHEMAS["ProductDetail"]["properties"], "status": PUBLISH, "version": VERSION,
    "createdAt": TIME, "updatedAt": TIME})
obj("SkuCreate", "创建 SKU，初始库存 0，通过库存调整接口入库。", {
    "skuCode": string("商家 SKU 编号。", "CARE-001", minLength=1, maxLength=64),
    "attributes": array("SkuAttribute", "同一产品内规格组合必须唯一", maxItems=10),
    "priceCents": MONEY, "enabled": boolean("可售。", True)}, ["skuCode", "attributes", "priceCents"])
obj("SkuPatch", "修改 SKU 价格、规格、启用状态。", {**SCHEMAS["SkuCreate"]["properties"], "version": VERSION}, ["version"], minProperties=2)
obj("AdminSku", "库存写入使用事务和版本控制。", {**SCHEMAS["Sku"]["properties"],
    "onHandStock": integer("实物库存，发货时扣减。", 102), "reservedStock": integer("待发货订单预占。", 2), "version": VERSION})
obj("StockAdjustmentInput", "入库／盘点调整，不能使 onHandStock 小于 reservedStock。", {
    "delta": {"type": "integer", "description": "正数入库，负数盘亏；不能为 0。", "example": 10, "not": {"enum": [0]}},
    "reason": string("调整原因。", "采购入库", minLength=1, maxLength=200), "version": VERSION})
obj("StockAdjustment", "不可改写的库存变更流水。", {
    "id": ID, "skuId": ID, "delta": {"type": "integer", "description": "库存变化。", "example": 10},
    "onHandStockAfter": integer("调整后实物库存。", 112), "reservedStockAfter": integer("调整后预占。", 2),
    "reason": TEXT, "operatorId": ID, "createdAt": TIME})

address_fields = {
    "recipient": string("收件人。", "张女士", minLength=1, maxLength=32), "phone": PHONE,
    "provinceCode": string("省级行政区划码。", "310000", pattern=r"^\d{6}$"),
    "province": string("省。", "上海市", minLength=1, maxLength=32),
    "cityCode": string("地市行政区划码。", "310100", pattern=r"^\d{6}$"),
    "city": string("市。", "上海市", minLength=1, maxLength=32),
    "districtCode": string("区县行政区划码。", "310101", pattern=r"^\d{6}$"),
    "district": string("区县。", "黄浦区", minLength=1, maxLength=32),
    "detail": string("详细地址。", "示例路 100 号", minLength=1, maxLength=200)}
obj("AddressSnapshot", "订单／退货地址快照；地址簿修改不影响历史订单。", address_fields)
obj("AddressInput", "地址簿写入；isDefault=true 在事务中取消其他默认地址。", {
    **address_fields, "isDefault": {**boolean("默认地址；首个地址自动默认；其他新增地址不传为 false。", True), "default": False}}, list(address_fields))
obj("Address", "用户地址。", {"id": ID, **SCHEMAS["AddressInput"]["properties"], "version": VERSION})
obj("AddressReplace", "完整替换本人地址，须带版本并明确默认标记。", {**SCHEMAS["AddressInput"]["properties"], "version": VERSION}, [*address_fields, "isDefault", "version"])
obj("PurchaseLineInput", "购买规格；不接收名称或金额。", {"skuId": ID, "quantity": QTY})
obj("ProductPurchase", "实物商品试算；同 SKU 必须先合并，否则校验失败。", {
    "type": enum("订单类型。", "PRODUCT"), "addressId": ID,
    "items": array("PurchaseLineInput", "同一订单多个 SKU", minItems=1, maxItems=50)})
obj("CoursePurchase", "单个课程购买；禁止重复购买有效课程权益。", {
    "type": enum("订单类型。", "COURSE"), "courseId": ID})
obj("MembershipPurchase", "购买一个会员方案；有效会员付款成功后顺延。", {
    "type": enum("订单类型。", "MEMBERSHIP"), "planId": ID})
union("QuoteCreate", "试算请求按 type 三选一，不支持混合商品、课程与会员。", ["ProductPurchase", "CoursePurchase", "MembershipPurchase"], "type")
obj("OrderItem", "不可变成交快照；价格调整不影响历史。", {
    "id": ID, "resourceId": ID, "resourceType": enum("引用 SKU／课程／会员方案。", "SKU|COURSE|MEMBERSHIP_PLAN"),
    "productId": {**ID, "nullable": True}, "title": string("商品或课程名快照。", "健康护理用品"),
    "skuAttributes": array("SkuAttribute", "非实物为 []"), "coverUrl": {**URI, "nullable": True},
    "quantity": QTY, "unitPriceCents": MONEY, "subtotalCents": MONEY,
    "refundedQuantity": integer("已完成退款件数。", 0), "refundedAmountCents": MONEY})
obj("OrderQuote", "十分钟内有效的服务端试算，不占库存，不授予权益。", {
    "quoteId": ID, "type": ORDER_TYPE, "items": array("OrderItem", "试算快照；订单创建后会分配新的 orderItem.id"),
    "itemsAmountCents": MONEY, "shippingFeeCents": {**MONEY, "example": 0}, "payableAmountCents": MONEY,
    "currency": enum("币种。", "CNY"), "address": {**ref("AddressSnapshot")}, "expiresAt": TIME},
    ["quoteId", "type", "items", "itemsAmountCents", "shippingFeeCents", "payableAmountCents", "currency", "expiresAt"])
obj("OrderCreate", "由有效试算生成订单；一个 quoteId 最多生成一个订单。", {"quoteId": ID})
obj("OrderSummary", "订单列表对象。", {
    "id": ID, "orderNo": string("展示用订单号，不能作为鉴权依据。", "20261022000001"), "type": ORDER_TYPE,
    "status": ORDER_STATUS, "paymentStatus": PAYMENT_STATUS,
    "afterSaleStatus": enum("订单售后汇总。", "NONE|PROCESSING|PARTIALLY_COMPLETED|COMPLETED"),
    "items": array("OrderItem", "行项目快照"), "itemsAmountCents": MONEY,
    "shippingFeeCents": {**MONEY, "example": 0}, "payableAmountCents": MONEY,
    "paidAmountCents": {**MONEY, "example": 0}, "refundedAmountCents": {**MONEY, "example": 0},
    "currency": enum("币种。", "CNY"), "paymentDeadlineAt": TIME,
    "paidAt": NULL_TIME, "createdAt": TIME})
obj("OrderActions", "前端用来控制按钮；调用时服务端再次校验。", {
    "canPay": boolean("可支付。", True), "canCancel": boolean("可取消。", True),
    "canConfirmReceipt": boolean("可确认收货。"), "canApplyAfterSale": boolean("可申请产品售后。")})
obj("OrderDetail", "本人订单详情；数字订单不返回 address 字段。", {
    **SCHEMAS["OrderSummary"]["properties"], "address": ref("AddressSnapshot"),
    "actions": ref("OrderActions"), "cancelReason": {**TEXT, "nullable": True},
    "cancelledAt": NULL_TIME, "completedAt": NULL_TIME, "closedReason": {**TEXT, "nullable": True},
    "version": VERSION}, [*SCHEMAS["OrderSummary"]["properties"], "actions", "cancelReason", "cancelledAt", "completedAt", "closedReason", "version"])
obj("OrderCancelInput", "只允许取消待支付订单。已支付实物走售后。", {
    "reason": string("取消原因。", "暂时不需要", minLength=1, maxLength=200), "version": VERSION})
obj("PaymentCreate", "一期支持二维码支付和网页跳转；不提供原生 App SDK 支付参数。", {
    "channel": enum("已配置支付通道。", "WECHAT_NATIVE|ALIPAY_PAGE")})
obj("PaymentAttempt", "支付尝试。多个尝试只能有一次合法订单入账。", {
    "id": ID, "orderId": ID, "channel": enum("支付渠道。", "WECHAT_NATIVE|ALIPAY_PAGE"),
    "status": enum("尝试状态；退款由 Refund 另行记录。", "PENDING|SUCCEEDED|CLOSED|FAILED"),
    "amountCents": MONEY, "launchType": enum("前端打开方式。", "QR_CODE|REDIRECT"),
    "launchUrl": string("二维码内容 URI（可为 weixin://）或支付网关 HTTPS 跳转地址。", "weixin://wxpay/bizpayurl?pr=demo", format="uri"),
    "expiresAt": TIME, "paidAt": NULL_TIME, "createdAt": TIME})
obj("LogisticsEvent", "物流事件；接口返回发生时间从新到旧。", {
    "time": TIME, "description": string("物流描述。", "快件已由收件人签收"),
    "location": {**string("位置。", "上海"), "nullable": True}})
obj("Shipment", "一期每笔实物订单一个包裹，全部行一次性发货。", {
    "id": ID, "orderId": ID, "carrierCode": string("快递公司代码。", "SF", minLength=1, maxLength=32),
    "carrierName": string("快递公司名称。", "顺丰速运"), "trackingNo": string("运单号。", "SF1234567890", minLength=1, maxLength=64),
    "status": enum("物流状态；不等于订单已确认收货。", "PENDING_PICKUP|IN_TRANSIT|OUT_FOR_DELIVERY|DELIVERED|EXCEPTION"),
    "shippedAt": TIME, "deliveredAt": NULL_TIME, "lastSyncedAt": NULL_TIME, "version": VERSION})
obj("LogisticsResult", "未发货返回 shipment=null、events=[]。", {
    "shipment": {"allOf": [ref("Shipment")], "nullable": True, "description": "无包裹时为 null。"},
    "events": array("LogisticsEvent", "最近物流事件"),
    "syncStatus": enum("同步状态；失败时保留上次数据。", "NOT_SHIPPED|UP_TO_DATE|PENDING|FAILED")})
obj("ShipmentCreate", "平台发货并扣减实物库存／释放预占库存。", {
    "carrierCode": string("快递公司代码。", "SF", minLength=1, maxLength=32),
    "trackingNo": string("运单号。", "SF1234567890", minLength=1, maxLength=64), "orderVersion": VERSION})
obj("ShipmentPatch", "仅 PENDING_PICKUP 且无揽收事件时允许纠错。", {
    "carrierCode": string("快递公司代码。", "SF", minLength=1, maxLength=32),
    "trackingNo": string("运单号。", "SF1234567891", minLength=1, maxLength=64),
    "reason": string("纠错原因。", "录入错误", minLength=1, maxLength=200), "version": VERSION})

# Product after-sales and digital refunds.
obj("AfterSaleLineInput", "按订单行申请退件，不接受客户端退款金额。", {"orderItemId": ID, "quantity": QTY})
obj("AfterSaleCreate", "只对本人的 PRODUCT 订单申请；一次申请支持多个行。", {
    "orderId": ID, "type": enum("未发货仅退款；发货后退货退款。", "REFUND_ONLY|RETURN_REFUND"),
    "items": array("AfterSaleLineInput", "行 ID 不重复；数量不超过剩余可售后量", minItems=1, maxItems=50),
    "reasonCode": enum("申请原因。", "NOT_NEEDED|QUALITY_ISSUE|WRONG_ITEM|OTHER"),
    "description": string("申请说明。", "收到的商品规格不符", minLength=1, maxLength=2000),
    "evidenceMediaIds": array(ID, "本人上传、用途 AFTERSALE_EVIDENCE 的 READY 图片", maxItems=9, uniqueItems=True)},
    ["orderId", "type", "items", "reasonCode", "description"])
obj("AfterSaleLine", "服务端计算的售后行快照。", {
    "orderItemId": ID, "quantity": QTY, "refundAmountCents": MONEY})
obj("ReturnShipment", "退货运单，不复用原出库运单。", {
    "carrierCode": string("快递代码。", "SF"), "trackingNo": string("退货单号。", "SF9988776655"), "submittedAt": TIME})
obj("AfterSale", "售后申请。", {
    "id": ID, "afterSaleNo": string("售后展示单号。", "AS202610220001"), "orderId": ID,
    "type": enum("售后类型。", "REFUND_ONLY|RETURN_REFUND"), "status": AFTERSALE_STATUS,
    "items": array("AfterSaleLine", "本次申请行"), "itemsRefundAmountCents": MONEY,
    "shippingRefundAmountCents": {**MONEY, "example": 0}, "refundAmountCents": MONEY,
    "reasonCode": enum("原因。", "NOT_NEEDED|QUALITY_ISSUE|WRONG_ITEM|OTHER"), "description": TEXT,
    "evidence": array("MediaSummary", "证据元数据，不含永久公开地址"),
    "reviewNote": {**TEXT, "nullable": True}, "returnDeadlineAt": NULL_TIME,
    "returnAddress": ref("AddressSnapshot"), "returnShipment": ref("ReturnShipment"),
    "refundId": {**ID, "nullable": True}, "createdAt": TIME, "updatedAt": TIME, "version": VERSION},
    ["id", "afterSaleNo", "orderId", "type", "status", "items", "itemsRefundAmountCents", "shippingRefundAmountCents", "refundAmountCents",
     "reasonCode", "description", "evidence", "reviewNote", "returnDeadlineAt", "refundId", "createdAt", "updatedAt", "version"])
obj("AfterSaleReview", "批准退货退款必须同时提供 returnAddress；拒绝必须 note 非空。", {
    "decision": enum("审核决定。", "APPROVE|REJECT"),
    "note": string("审核说明。", "同意申请", minLength=1, maxLength=1000),
    "returnAddress": ref("AddressSnapshot"), "version": VERSION}, ["decision", "note", "version"])
obj("ReturnShipmentInput", "用户提交退货物流。", {
    "carrierCode": string("快递代码。", "SF", minLength=1, maxLength=32),
    "trackingNo": string("退货单号。", "SF9988776655", minLength=1, maxLength=64), "version": VERSION})
obj("ReturnReceiptInput", "管理员验收通过才发起退款；需补证或异常保持 RETURNING，人工跟进。", {
    "note": string("验收说明。", "退件验收通过", minLength=1, maxLength=1000), "version": VERSION})
obj("Refund", "退款流水；本地请求成功不代表支付渠道已退款。", {
    "id": ID, "orderId": ID, "afterSaleId": {**ID, "nullable": True},
    "reasonType": enum("退款来源。", "AFTERSALE|DIGITAL_ORDER|LATE_PAYMENT|DUPLICATE_PAYMENT"),
    "amountCents": MONEY, "status": enum("渠道退款状态。", "PENDING|PROCESSING|SUCCEEDED|FAILED"),
    "failureCode": {**string("失败原因码。", "CHANNEL_TEMPORARY_ERROR"), "nullable": True},
    "createdAt": TIME, "completedAt": NULL_TIME})
obj("DigitalRefundInput", "人工全额退款数字订单；不接受金额；成功后撤销对应购买权益。", {
    "reason": string("处理原因。", "客服确认退款", minLength=1, maxLength=1000), "orderVersion": VERSION})

# Membership plans and entitlements.
obj("MembershipPlan", "会员方案快照；一期无自动续费。", {
    "id": ID, "name": string("方案名。", "30 天会员", minLength=1, maxLength=64),
    "priceCents": MONEY, "currency": enum("币种。", "CNY"), "durationDays": integer("有效天数；按 durationDays*24h 延长。", 30, 1, maximum=3660),
    "aiDailyLimit": integer("该方案每日 AI 次数；自然日按 Asia/Shanghai。", 100),
    "benefitCodes": array(enum("可配置权益编码。", "MEMBER_COURSES|AI_DAILY_QUOTA"), "权益", uniqueItems=True),
    "description": TEXT})
obj("MembershipPlanCreate", "创建会员方案，默认停用。", {
    **{k: v for k, v in SCHEMAS["MembershipPlan"]["properties"].items() if k not in ("id", "currency")},
    "sortOrder": integer("展示顺序。", 0)}, ["name", "priceCents", "durationDays", "aiDailyLimit", "benefitCodes", "description"])
obj("MembershipPlanPatch", "只影响后续购买；历史订单与权益使用成交快照。", {
    **SCHEMAS["MembershipPlanCreate"]["properties"], "enabled": boolean("是否可购买。", True), "version": VERSION}, ["version"], minProperties=2)
obj("AdminMembershipPlan", "管理端会员方案。", {**SCHEMAS["MembershipPlan"]["properties"],
    "enabled": boolean("可购买。", False), "sortOrder": integer("排序。", 0), "version": VERSION})
obj("MembershipDetail", "当前会员及最近权益来源；会员资格由购买流水投影产生。", {
    **SCHEMAS["MembershipSummary"]["properties"], "currentPlanName": {**string("当前时段生效方案名。", "30 天会员"), "nullable": True},
    "aiDailyLimit": integer("当前时段日限额；非会员使用基础额度。", 100), "updatedAt": TIME})
obj("CourseEntitlement", "独立购买课程的永久阅读权；退款后撤销。会员可读内容不混入已购列表。", {
    "id": ID, "course": ref("ContentSummary"), "orderId": ID,
    "status": enum("授权状态；下架不自动撤销已购权。", "ACTIVE|REVOKED"), "grantedAt": TIME})

# AI, notification, media and user administration.
obj("AiQuota", "问答额度；服务端原子预占，失败且无有效输出时归还。", {
    "date": string("额度日期，Asia/Shanghai。", "2026-10-22", format="date"),
    "limit": integer("今日当前额度上限。", 100), "used": integer("已结算使用次数。", 3),
    "reserved": integer("生成中的预占次数。", 1), "remaining": integer("max(0,limit-used-reserved)。", 96), "resetsAt": TIME})
obj("AiConversationInput", "创建会话。", {"title": string("标题；不传则服务端生成。", "健康知识咨询", minLength=1, maxLength=100)}, [])
obj("AiConversationPatch", "改名。", {"title": string("标题。", "日常健康知识", minLength=1, maxLength=100)})
obj("AiConversation", "仅本人可读取；管理端用户查询不包含 AI 会话。", {
    "id": ID, "title": string("标题。", "健康知识咨询"), "createdAt": TIME, "updatedAt": TIME})
obj("AiMessageInput", "每个会话同一时间一个生成任务；clientMessageId 在本人会话内唯一。", {
    "clientMessageId": string("前端生成 UUID，网络重试复用。", "bde07d36-f847-4da9-8fa7-6e4c53e37aa0", format="uuid"),
    "content": string("用户问题；只做健康知识问答。", "怎样理解日常健康管理？", minLength=1, maxLength=4000)})
obj("AiMessage", "持久化消息；失败输出不能伪装为完整回答。", {
    "id": ID, "conversationId": ID, "role": enum("消息角色。", "USER|ASSISTANT"),
    "content": string("正文；生成中可为部分文本。", "以下是一般健康知识。", maxLength=50000),
    "status": enum("消息状态。", "QUEUED|GENERATING|COMPLETED|FAILED|CANCELLED|BLOCKED"),
    "generationId": {**ID, "nullable": True}, "createdAt": TIME})
obj("AiMessagePage", "历史消息使用游标；按 createdAt,id 降序，界面可反向展示。", {
    "items": array("AiMessage", "消息"), "nextCursor": {**string("不透明游标。", "cursor_demo"), "nullable": True}, "hasMore": boolean("有下一批。")})
obj("AiGeneration", "异步生成任务；先返回任务，再流式订阅或轮询。", {
    "id": ID, "conversationId": ID, "userMessageId": ID, "assistantMessageId": ID,
    "status": enum("生成状态。", "QUEUED|GENERATING|COMPLETED|FAILED|CANCELLED|BLOCKED"),
    "errorCode": {**string("失败业务码。", "AI_PROVIDER_UNAVAILABLE"), "nullable": True},
    "createdAt": TIME, "completedAt": NULL_TIME})
obj("SseMetaEvent", "event: meta，含生成任务身份。", {"generationId": ID, "assistantMessageId": ID})
obj("SseDeltaEvent", "event: delta；按 SSE id 去重并依序拼接。", {"text": string("增量内容。", "日常健康")})
obj("SseDoneEvent", "event: done，流结束；以消息查询作为最终事实。", {
    "generationId": ID, "assistantMessageId": ID, "finishReason": enum("终止原因。", "STOP|LENGTH|CANCELLED|BLOCKED")})
obj("SseErrorEvent", "event: error；流已打开，不能改成 HTTP JSON 错误。", {
    "code": string("业务错误码。", "AI_PROVIDER_UNAVAILABLE"), "message": TEXT, "retryable": boolean("可重新发起问题。", True)})
obj("NotificationTarget", "前端按 type 路由；只传业务 ID，不接受任意跳转 URL。", {
    "type": enum("目标页面。", "ORDER|AFTERSALE|CONTENT|MEMBERSHIP|NONE"), "resourceId": {**ID, "nullable": True}})
obj("Notification", "站内消息；系统事件可靠投递，目标读取仍需鉴权。", {
    "id": ID, "category": enum("消息类别。", "ORDER|LOGISTICS|AFTERSALE|MEMBERSHIP|SYSTEM"),
    "title": string("标题。", "订单已发货", maxLength=100), "body": string("纯文本正文。", "您的订单已发货，可查看物流。", maxLength=2000),
    "target": ref("NotificationTarget"), "readAt": NULL_TIME, "createdAt": TIME})
obj("UnreadCount", "本人未读统计。", {"count": integer("未读条数。", 3)})
obj("ReadAllInput", "只标记截止时间前的消息，避免吞掉并发新消息。", {"before": TIME})
obj("NotificationTaskInput", "管理员发送站内通知；指定用户或全体活跃用户二选一。", {
    "audience": enum("接收范围。", "USERS|ALL_ACTIVE"),
    "userIds": array(ID, "USERS 必填；ALL_ACTIVE 禁止传", minItems=1, maxItems=1000, uniqueItems=True),
    "title": string("标题。", "服务通知", minLength=1, maxLength=100),
    "body": string("纯文本。", "平台内容已更新。", minLength=1, maxLength=2000), "target": ref("NotificationTarget")},
    ["audience", "title", "body", "target"])
obj("NotificationTask", "异步站内通知任务；按 taskId+userId 去重，不暴露其他用户资料。", {
    "id": ID, "status": enum("投递状态。", "PENDING|RUNNING|COMPLETED|PARTIAL_FAILED|FAILED"),
    "title": string("标题。", "服务通知"), "recipientCount": integer("接收人数。", 100),
    "sentCount": integer("已发送人数。", 100), "failedCount": integer("失败人数。", 0), "createdAt": TIME})
obj("UploadCreate", "预签名直传；服务端按用途限制媒体类型与权限。", {
    "purpose": enum("普通用户仅 AVATAR/AFTERSALE_EVIDENCE；管理员可上传内容及产品素材。", "AVATAR|AFTERSALE_EVIDENCE|CONTENT_COVER|CONTENT_BODY_IMAGE|CONTENT_VIDEO|PRODUCT_IMAGE|COLUMN_COVER"),
    "fileName": string("显示名，不作为存储路径。", "cover.jpg", minLength=1, maxLength=200),
    "mimeType": enum("一期允许类型。", "image/jpeg|image/png|image/webp|video/mp4"),
    "sizeBytes": integer("预期大小；服务端检查真实大小。图片<=10MiB，视频<=1GiB。", 102400, 1, maximum=1073741824)})
obj("UploadTicket", "PUT 到对象存储，不经过业务 API；必须带返回 headers。", {
    "uploadId": ID, "mediaId": ID, "method": enum("上传方法。", "PUT"),
    "uploadUrl": {**URI, "example": "https://storage.example.com/upload?signature=demo"},
    "headers": {"type": "object", "description": "上传时原样携带的请求头。", "additionalProperties": {"type": "string"}, "example": {"Content-Type": "image/jpeg"}},
    "expiresAt": TIME})
obj("MediaReadGrant", "证据图片短时读取授权，仅本人及售后管理员。", {"mediaId": ID, "url": URI, "expiresAt": TIME})
obj("AdminUser", "管理端用户详情；默认仅脱敏手机号，无密码、refreshToken、AI 内容。", {
    **SCHEMAS["UserSummary"]["properties"], "banReason": {**TEXT, "nullable": True}, "bannedUntil": NULL_TIME,
    "lastLoginAt": NULL_TIME, "version": VERSION})
obj("UserBanInput", "封禁立即撤销会话；到期解禁仍需重新登录。禁止用封禁阻止支付补账／退款。", {
    "reason": string("封禁原因。", "违反平台规则", minLength=1, maxLength=1000),
    "until": {**TIME, "nullable": True, "description": "未来 UTC 时间；null 代表永久。"}, "version": VERSION})
obj("UserUnbanInput", "解封不恢复已撤销的令牌。", {"reason": string("解封原因。", "申诉处理完成", minLength=1, maxLength=1000), "version": VERSION})
obj("AdminOrder", "管理端订单，包含必要履约联系信息；读取需审计。", {
    **SCHEMAS["OrderDetail"]["properties"], "user": ref("UserSummary")},
    [*SCHEMAS["OrderDetail"]["required"], "user"])
obj("AdminOrderSummary", "管理端订单列表；收货地址仅详情接口返回。", {
    **SCHEMAS["OrderSummary"]["properties"], "user": ref("UserSummary")})
obj("AuditLog", "关键操作审计；请求体需脱敏，不记录密码令牌与健康问答正文。", {
    "id": ID, "actorId": ID, "action": string("操作名。", "order.ship"),
    "resourceType": string("资源类型。", "ORDER"), "resourceId": ID,
    "requestId": string("追踪号。", "req_demo_001"), "createdAt": TIME})
SCHEMAS["ExternalWebhookPayload"] = {
    "type": "object", "additionalProperties": True,
    "description": "支付渠道的原始协议载荷，不是本平台 DTO。字段、加密、签名头及 ACK 格式按商户所接协议实现；不由客户端调用。"}

# Conditional body contracts: allow exactly one body kind.
obj("ArticleBodyWrite", "图文正文写入；内容类型须由路由对应的资源匹配。", {
    "version": VERSION, "bodyHtml": string("服务端清洗的正文。", "<p>科普正文</p>", minLength=1, maxLength=500000),
    "imageMediaIds": array(ID, "全部正文图片 ID；无图片传 []", maxItems=100, uniqueItems=True)})
obj("VideoBodyWrite", "视频正文写入；仅 READY 且已转码素材。", {"version": VERSION, "videoMediaId": ID})
union("ScienceBodyInput", "图文与视频请求二选一；同样适用于课程章节。", ["ArticleBodyWrite", "VideoBodyWrite"])
SCHEMAS["AdminBody"]["properties"]["bodyHtml"] = {
    **string("图文 HTML；视频为 null。", "<p>科普正文</p>", maxLength=500000), "nullable": True}
# Inline nullable object: OpenAPI 3.0 ignores nullable siblings next to a bare $ref.
SCHEMAS["LogisticsResult"]["properties"]["shipment"] = {**copy.deepcopy(SCHEMAS["Shipment"]), "nullable": True}


def query(name, schema, required=False):
    return {"name": name, "in": "query", "required": required, "schema": schema,
            "description": schema.get("description", "")}


PAGINATION = [query("page", integer("页码，默认 1。", 1, 1, default=1)),
              query("pageSize", integer("每页条数，默认 20，最多 100。", 20, 1, maximum=100, default=20))]
KEYWORD = query("keyword", string("搜索标题／名称；去首尾空格，最长 100。", "健康", maxLength=100))
CATEGORY_ID = query("categoryId", ID)
STATUS_FILTER = query("status", PUBLISH)
DATE_FILTER = [query("createdFrom", TIME), query("createdTo", TIME)]
SORT_CREATED = query("sort", enum("白名单排序，默认 createdAt:desc；同值用 id 排序。", "createdAt:desc|createdAt:asc"))


def op(tag, method, path, title, *, auth="user", permission=None, body=None, data="ActionResult",
       params=None, note="", status=200, idem=False, response_kind="json"):
    OPERATIONS.append(dict(tag=tag, method=method, path=path, title=title, auth=auth,
                           permission=permission, body=body, data=data, params=params or [],
                           note=note, status=status, idem=idem, response_kind=response_kind))


def paged(tag, path, title, item, *, params=None, **kw):
    op(tag, "get", path, title, data=page(item), params=[*PAGINATION, *(params or [])], **kw)


def crud(tag, path, noun, output, create, patch, permission, *, filters=None):
    paged(tag, path, f"查询{noun}列表", output, auth="admin", permission=permission,
          params=filters or [])
    op(tag, "post", path, f"创建{noun}", auth="admin", permission=permission, body=create,
       data=output, status=201)
    op(tag, "get", path + "/{id}", f"查询{noun}详情", auth="admin", permission=permission, data=output)
    op(tag, "patch", path + "/{id}", f"修改{noun}", auth="admin", permission=permission, body=patch, data=output)
    op(tag, "delete", path + "/{id}", f"删除{noun}", auth="admin", permission=permission,
       params=[query("version", VERSION, True)], note="软删除。仅未被订单、权益或其他资源引用的草稿可删除；其他情况先下架。")


def publish_ops(tag, path, noun, output, permission):
    for action, label in [("publish", "发布"), ("unpublish", "下架")]:
        op(tag, "post", path + f"/{{id}}/{action}", f"{label}{noun}", auth="admin", permission=permission,
           body="VersionInput", data=output,
           note="发布前校验全部必填资料、启用分类和 READY 素材。下架停止新购买与公开发现，已有购买权益可从已购入口访问。")


# 01 Authentication and profile.
obj("HealthStatus", "服务与数据库就绪状态；不返回内部连接信息。", {
    "status": enum("就绪时返回 ok。", "ok")})
op("01 登录与鉴权", "get", "/health", "服务与数据库健康检查", auth="public", data="HealthStatus")
obj("LegalDocument", "注册页显示的当前协议；配置版本与注册记录一致。", {
    "type": enum("协议类型。", "TERMS|PRIVACY"), "version": string("版本。", "2026-10-01"),
    "contentHtml": string("协议全文 HTML。", "<p>协议示例</p>"), "updatedAt": TIME})
op("01 登录与鉴权", "get", "/public/legal-documents/{type}", "获取当前协议", auth="public", data="LegalDocument")
op("01 登录与鉴权", "post", "/auth/sms-codes", "获取短信验证码", auth="public", body="SmsRequest", data="SmsChallenge", status=202,
   note="暂缓实现，当前调用返回 404。以下为未来短信接入设计：验证码不返回客户端；有效期 5 分钟、单用途、一次性，最多 5 次验证。")
op("01 登录与鉴权", "post", "/auth/register", "用户注册", auth="public", body="RegisterInput", data="AuthTokens", status=201,
   note="当前使用手机号和密码注册，无验证码。协议版本须等于当前版本；不接受 role、status、membership、smsCode、challengeId 等字段。手机号唯一，phone_verified_at 保持 NULL。")
op("01 登录与鉴权", "post", "/auth/login/password", "密码登录", auth="public", body="PasswordLoginInput", data="AuthTokens")
op("01 登录与鉴权", "post", "/auth/login/sms", "短信登录", auth="public", body="SmsLoginInput", data="AuthTokens", note="暂缓实现，当前返回 404；开通短信服务后再启用。")
op("01 登录与鉴权", "post", "/auth/refresh", "轮换客户端令牌", auth="refresh", body="RefreshInput", data="AuthTokens")
op("01 登录与鉴权", "post", "/auth/logout", "退出当前会话", note="撤销当前 accessToken 所属 session 及整个 refresh 链。")
op("01 登录与鉴权", "post", "/auth/password/reset", "忘记密码重置", auth="public", body="PasswordResetInput", note="暂缓实现，当前返回 404；未接入身份核验前不能仅凭手机号重置密码。已登录用户可凭旧密码调用 PUT /me/password。")
op("02 用户与地址", "get", "/me", "本人资料", data="UserSummary")
op("02 用户与地址", "patch", "/me", "修改本人资料", body="UserPatch", data="UserSummary")
op("02 用户与地址", "put", "/me/password", "修改本人密码", body="PasswordChangeInput")
paged("02 用户与地址", "/me/sessions", "本人设备会话", "Session")
op("02 用户与地址", "delete", "/me/sessions/{id}", "撤销本人设备会话", note="不能撤销其他用户会话；撤销当前设备后需要重新登录。")
paged("02 用户与地址", "/me/addresses", "本人收货地址列表", "Address")
op("02 用户与地址", "post", "/me/addresses", "新增收货地址", body="AddressInput", data="Address", status=201)
op("02 用户与地址", "get", "/me/addresses/{id}", "收货地址详情", data="Address")
op("02 用户与地址", "put", "/me/addresses/{id}", "替换收货地址", body="AddressReplace", data="Address")
op("02 用户与地址", "delete", "/me/addresses/{id}", "删除收货地址", params=[query("version", VERSION, True)],
   note="仅删除地址簿记录；若它是默认地址，剩余最近更新地址成为默认。历史订单快照不受影响。")

# 03 Discovery and protected content.
paged("03 视频、图文与专栏", "/categories", "查询启用分类", "Category", auth="public",
      params=[query("scope", enum("分类域。", "CONTENT|PRODUCT"), True), query("parentId", ID)])
for path, title, kinds in [("/videos", "视频科普／视频课程", "SCIENCE_VIDEO|VIDEO_COURSE"),
                           ("/articles", "图文科普／图文课程", "SCIENCE_ARTICLE|ARTICLE_COURSE")]:
    paged("03 视频、图文与专栏", path, f"浏览／搜索{title}", "ContentSummary", auth="public",
          params=[KEYWORD, CATEGORY_ID, query("kind", enum("内容类型过滤；不传则包含此路由两种类型。", kinds)),
                  query("columnId", ID), query("accessPolicy", ACCESS),
                  query("sort", enum("排序白名单，默认 publishedAt:desc。", "publishedAt:desc|publishedAt:asc|priceCents:asc|priceCents:desc"))],
          note="仅返回 PUBLISHED；只搜索公开标题、标签和简介，不能命中付费正文。")
    op("03 视频、图文与专栏", "get", path + "/{id}", f"查询{title}详情", auth="optional", data="ContentDetail",
       note="必须匹配路由的内容类型。OFFLINE 课程仅持有有效独立购买权益者能由已购入口读取。")
op("03 视频、图文与专栏", "get", "/videos/{id}/playback", "获取科普视频播放授权", auth="optional", data="PlaybackGrant",
   note="仅 SCIENCE_VIDEO；短时 URL 建议 5 分钟。课程视频走章节接口。")
op("03 视频、图文与专栏", "get", "/articles/{id}/body", "读取科普图文正文", auth="optional", data="ArticleBody",
   note="仅 SCIENCE_ARTICLE；课程图文走章节正文接口。")
paged("03 视频、图文与专栏", "/courses/{id}/chapters", "课程目录", "ChapterSummary", auth="optional",
      note="id 必须是课程。游客／普通会员只展示 PUBLISHED 章节；持有该课有效独立购买权益者可见 PUBLISHED 与 OFFLINE 历史章节，DRAFT 始终不可见。按 sortOrder,id 升序。")
op("03 视频、图文与专栏", "get", "/chapters/{id}/body", "读取课程图文章节", auth="optional", data="ArticleBody",
   note="仅 ARTICLE 章节；免费预览可匿名，否则校验课程购买／会员权益。返回 contentId 为所属课程 ID。")
op("03 视频、图文与专栏", "get", "/chapters/{id}/playback", "获取课程视频播放授权", auth="optional", data="PlaybackGrant",
   note="仅 VIDEO 章节；isPreview=true 可匿名播放该完整预览章，其余章校验购买／会员权益。")
paged("03 视频、图文与专栏", "/columns", "专栏列表", "Column", auth="public", params=[KEYWORD], note="仅 PUBLISHED，按 sortOrder,id 升序。")
op("03 视频、图文与专栏", "get", "/columns/{id}", "专栏详情", auth="public", data="Column")
paged("03 视频、图文与专栏", "/columns/{id}/contents", "专栏内容列表", "ContentSummary", auth="public",
      params=[query("kind", CONTENT_KIND)], note="只返回 PUBLISHED 内容；按专栏关联 sortOrder,id 升序。不会授予付费内容访问权。")

# 04 Products and orders.
paged("04 产品", "/products", "浏览／搜索产品", "ProductSummary", auth="public",
      params=[KEYWORD, CATEGORY_ID, query("minPriceCents", MONEY), query("maxPriceCents", MONEY),
              query("inStock", boolean("仅展示有库存产品。", True)),
              query("sort", enum("默认 createdAt:desc；价格排序基于产品最低可售 SKU 价。", "createdAt:desc|priceCents:asc|priceCents:desc"))])
op("04 产品", "get", "/products/{id}", "产品详情（含 SKU）", auth="public", data="ProductDetail")
op("05 订单、支付与物流", "post", "/order-quotes", "商品／课程／会员下单试算", body="QuoteCreate", data="OrderQuote", status=201,
   note="绑定当前用户，10 分钟有效；实物需本人有效地址。只试算不占库存。金额与运费完全由服务端计算。")
op("05 订单、支付与物流", "post", "/orders", "创建订单", body="OrderCreate", data="OrderDetail", status=201, idem=True,
   note="一个 quoteId 仅建一单；事务检查可售状态和库存后预占。试算期内按报价成交，不接受前端金额。待支付 30 分钟超时关闭。")
paged("05 订单、支付与物流", "/orders", "本人订单列表", "OrderSummary",
      params=[query("type", ORDER_TYPE), query("status", ORDER_STATUS), query("paymentStatus", PAYMENT_STATUS), *DATE_FILTER, SORT_CREATED])
op("05 订单、支付与物流", "get", "/orders/{id}", "本人订单详情", data="OrderDetail")
op("05 订单、支付与物流", "post", "/orders/{id}/cancel", "取消待支付订单", body="OrderCancelInput", data="OrderDetail", idem=True,
   note="与支付入账抢同一订单锁；只允许 PENDING_PAYMENT。释放预占并异步关闭渠道支付单。")
op("05 订单、支付与物流", "post", "/orders/{id}/payment-attempts", "发起订单支付", body="PaymentCreate", data="PaymentAttempt", status=201, idem=True,
   note="只允许未过期、未支付订单。同通道未过期支付尝试可复用；支付金额从订单读取。支付回跳不授予权益。")
op("05 订单、支付与物流", "get", "/payment-attempts/{id}", "查询本人支付状态", data="PaymentAttempt")
op("05 订单、支付与物流", "post", "/payment-attempts/{id}/sync", "主动补查渠道支付结果", data="PaymentAttempt",
   note="服务端直接查询渠道并复用入账逻辑；按用户和支付尝试限流，禁止用前端结果更新状态。")
op("05 订单、支付与物流", "get", "/orders/{id}/logistics", "本人订单物流", data="LogisticsResult",
   note="仅实物订单；未发货也返回 200。后台定时查快递渠道；同步失败保留最后成功快照。")
op("05 订单、支付与物流", "post", "/orders/{id}/confirm-receipt", "确认收货", body="VersionInput", data="OrderDetail", idem=True,
   note="仅 PENDING_RECEIPT；存在进行中售后则拒绝。物流签收不会直接代替用户确认；一期不自动收货。")
paged("05 订单、支付与物流", "/orders/{id}/refunds", "本人订单退款进度", "Refund")
for path, label in [("/webhooks/payments/{provider}", "支付结果回调"), ("/webhooks/refunds/{provider}", "退款结果回调")]:
    op("06 渠道回调（非前端）", "post", path, label, auth="webhook", body="ExternalWebhookPayload", response_kind="provider",
       note="provider=wechat 或 alipay。读取原始 body；验证渠道签名、证书／密钥、时间窗、商户号、币种、金额和交易号，必要时解密及主动查单。渠道重试可重复到达。ACK 严格遵循所接商户协议，不套统一响应。")

# 07 Membership and after-sales.
paged("07 会员与已购课程", "/membership-plans", "可购买会员方案", "MembershipPlan", auth="public", note="仅启用方案，按 sortOrder,id 升序。")
op("07 会员与已购课程", "get", "/membership-plans/{id}", "会员方案详情", auth="public", data="MembershipPlan")
op("07 会员与已购课程", "get", "/me/membership", "本人会员权益", data="MembershipDetail")
paged("07 会员与已购课程", "/me/courses", "本人独立购买课程", "CourseEntitlement",
      params=[query("status", enum("默认 ACTIVE。", "ACTIVE|REVOKED"))])
op("08 产品售后", "post", "/aftersales", "申请产品售后", body="AfterSaleCreate", data="AfterSale", status=201, idem=True,
   note="仅本人已支付实物订单。未发货 REFUND_ONLY；已发货 RETURN_REFUND，完成后 7*24h 内可申请（设计默认值）。同一订单同时最多一张活跃售后单；单张可包含多行，终态后可申请剩余量。原子冻结数量、退款额度和未发货订单的整单发货。")
paged("08 产品售后", "/aftersales", "本人售后列表", "AfterSale", params=[query("status", AFTERSALE_STATUS), query("orderId", ID)])
op("08 产品售后", "get", "/aftersales/{id}", "本人售后详情", data="AfterSale")
op("08 产品售后", "post", "/aftersales/{id}/cancel", "撤销售后申请", body="VersionInput", data="AfterSale", idem=True,
   note="仅 PENDING_REVIEW／AWAITING_RETURN；释放本次冻结。已提交退货运单或已发起退款不可撤销。")
op("08 产品售后", "post", "/aftersales/{id}/return-shipment", "填写退货物流", body="ReturnShipmentInput", data="AfterSale", idem=True,
   note="仅 AWAITING_RETURN 且未超过退货期限；转 RETURNING。批准退货后 7*24h 内未提交运单则 CLOSED 并释放冻结。")

# 09 AI and notifications.
op("09 大模型问答", "get", "/ai/quota", "本人问答额度", data="AiQuota")
paged("09 大模型问答", "/ai/conversations", "本人会话列表", "AiConversation", params=[SORT_CREATED])
op("09 大模型问答", "post", "/ai/conversations", "创建问答会话", body="AiConversationInput", data="AiConversation", status=201)
op("09 大模型问答", "get", "/ai/conversations/{id}", "会话详情", data="AiConversation")
op("09 大模型问答", "patch", "/ai/conversations/{id}", "会话改名", body="AiConversationPatch", data="AiConversation")
op("09 大模型问答", "delete", "/ai/conversations/{id}", "删除本人会话", note="同时取消进行中任务，立即撤销读取；正文按保留策略清理。")
op("09 大模型问答", "get", "/ai/conversations/{id}/messages", "会话历史消息", data="AiMessagePage",
   params=[query("cursor", string("不透明游标；第一页不传。", "cursor_demo", maxLength=512)),
           query("limit", integer("默认 20，最多 100。", 20, 1, maximum=100, default=20))])
op("09 大模型问答", "post", "/ai/conversations/{id}/messages", "提问并创建生成任务", body="AiMessageInput", data="AiGeneration", status=202, idem=True,
   note="先做输入过滤再原子预占次数；clientMessageId 防止跨幂等键重复提问。一次只允许一个活跃生成任务。模型调用失败且无有效输出返还次数。")
op("09 大模型问答", "get", "/ai/generations/{id}", "查询生成任务", data="AiGeneration")
op("09 大模型问答", "get", "/ai/generations/{id}/events", "订阅生成任务 SSE", response_kind="sse",
   note="使用支持 Authorization 请求头的 fetch 流。仅订阅已存在任务，不会再次扣额度；Last-Event-ID 从最后确认序号续读。断流不取消生成。")
op("09 大模型问答", "post", "/ai/generations/{id}/cancel", "停止生成", data="AiGeneration", idem=True,
   note="终态重复调用返回原任务；取消前已有有效输出则计一次，无输出返还预占。")
paged("10 消息与通知", "/me/notifications", "本人消息列表", "Notification",
      params=[query("category", enum("类别。", "ORDER|LOGISTICS|AFTERSALE|MEMBERSHIP|SYSTEM")), query("unreadOnly", boolean("只看未读。", True))])
op("10 消息与通知", "get", "/me/notifications/unread-count", "未读数量", data="UnreadCount")
op("10 消息与通知", "get", "/me/notifications/{id}", "消息详情", data="Notification", note="读取详情不自动标已读。")
op("10 消息与通知", "put", "/me/notifications/{id}/read", "幂等标记已读", data="Notification")
op("10 消息与通知", "put", "/me/notifications/read-all", "批量已读", body="ReadAllInput")
op("10 消息与通知", "delete", "/me/notifications/{id}", "删除本人站内消息")
op("11 文件与媒体", "post", "/uploads", "申请直传地址", auth="authenticated", body="UploadCreate", data="UploadTicket", status=201,
   note="支持 client 或 admin 令牌；按 aud 和用途校验。普通用户禁止上传视频；管理员需 media:write。AVATAR／AFTERSALE_EVIDENCE 仅允许图片。")
op("11 文件与媒体", "post", "/uploads/{id}/complete", "通知上传完成", auth="authenticated", data="MediaSummary",
   note="校验文件实际大小、MIME、校验和及安全处理后变 READY；视频异步转码，处理中返回 PROCESSING。重复调用不重复转码。")
op("11 文件与媒体", "get", "/media/{id}", "读取可管理媒体处理状态", auth="authenticated", data="MediaSummary",
   note="客户仅本人素材；管理员需 media:write 且只管理后台用途素材，不借此读取客户私有证据。")
op("11 文件与媒体", "post", "/media/{id}/read-grant", "申请私有凭证图片读取授权", auth="authenticated", data="MediaReadGrant",
   note="仅证据所有者及有关联售后且有 aftersales:review 的管理员；有效 5 分钟。内容视频必须走专用播放授权，不能由此获取。")
op("11 文件与媒体", "delete", "/media/{id}", "删除未引用的本人素材", auth="authenticated", note="已被内容、订单或售后引用时拒绝；管理员素材需 media:write。")

# 12 Administration.
op("12 管理端鉴权", "post", "/admin/auth/login", "管理员登录", auth="admin_login", body="AdminLoginInput", data="AdminAuthTokens",
   note="不要求已经登录，但只验证独立管理员账号与密码，不接受客户凭证。")
op("12 管理端鉴权", "post", "/admin/auth/refresh", "轮换管理员令牌", auth="admin_refresh", body="RefreshInput", data="AdminAuthTokens")
op("12 管理端鉴权", "post", "/admin/auth/logout", "管理员退出", auth="admin")
op("12 管理端鉴权", "get", "/admin/me", "当前管理员与权限", auth="admin", data="AdminPrincipal")
crud("13 分类与内容管理", "/admin/categories", "分类", "Category", "CategoryCreate", "CategoryPatch", "content:write",
     filters=[query("scope", enum("作用域。", "CONTENT|PRODUCT")), KEYWORD])
OPERATIONS[-1]["note"] = "分类存在子分类或内容／产品引用时拒绝删除。产品分类管理也需 content:write（共享分类权限）。"
crud("13 分类与内容管理", "/admin/contents", "科普／课程", "AdminContent", "ContentCreate", "ContentPatch", "content:write",
     filters=[query("kind", CONTENT_KIND), STATUS_FILTER, CATEGORY_ID, KEYWORD, SORT_CREATED])
publish_ops("13 分类与内容管理", "/admin/contents", "科普／课程", "AdminContent", "content:write")
op("13 分类与内容管理", "get", "/admin/contents/{id}/body", "查询科普正文／视频引用", auth="admin", permission="content:write", data="AdminBody")
op("13 分类与内容管理", "put", "/admin/contents/{id}/body", "替换科普正文／视频引用", auth="admin", permission="content:write", body="ScienceBodyInput", data="AdminBody",
   note="仅 SCIENCE_*；课程需使用章节接口。清洗 HTML，并校验正文图片归属、用途与引用完整性。")
paged("13 分类与内容管理", "/admin/courses/{id}/chapters", "管理课程章节列表", "AdminChapter", auth="admin", permission="content:write", params=[STATUS_FILTER])
op("13 分类与内容管理", "post", "/admin/courses/{id}/chapters", "创建课程章节草稿", auth="admin", permission="content:write", body="ChapterCreate", data="AdminChapter", status=201)
for method, title, body in [("get", "章节详情", None), ("patch", "修改章节", "ChapterPatch"), ("delete", "删除未发布章节", None)]:
    op("13 分类与内容管理", method, "/admin/chapters/{id}", title, auth="admin", permission="content:write", body=body,
       data="ActionResult" if method == "delete" else "AdminChapter",
       params=[query("version", VERSION, True)] if method == "delete" else [],
       note="章节类型由课程继承。已发布或有购买关联的章节不可删除，可下架并保留已购访问。")
op("13 分类与内容管理", "get", "/admin/chapters/{id}/body", "查询章节正文／视频引用", auth="admin", permission="content:write", data="AdminBody")
op("13 分类与内容管理", "put", "/admin/chapters/{id}/body", "替换章节正文／视频引用", auth="admin", permission="content:write", body="ScienceBodyInput", data="AdminBody",
   note="请求正文类型必须匹配章节；更新正文会递增章节 version。")
publish_ops("13 分类与内容管理", "/admin/chapters", "课程章节", "AdminChapter", "content:write")
crud("14 专栏管理", "/admin/columns", "专栏", "AdminColumn", "ColumnCreate", "ColumnPatch", "content:write", filters=[STATUS_FILTER, KEYWORD])
publish_ops("14 专栏管理", "/admin/columns", "专栏", "AdminColumn", "content:write")
paged("14 专栏管理", "/admin/columns/{id}/contents", "专栏已关联内容", "AdminContent", auth="admin", permission="content:write",
      params=[STATUS_FILTER, query("kind", CONTENT_KIND)])
op("14 专栏管理", "put", "/admin/columns/{id}/contents/{contentId}", "关联内容／修改专栏内排序", auth="admin", permission="content:write", body="ColumnContentInput",
   note="幂等 upsert；同一内容可属于多个专栏。不会修改内容自身发布状态或价格。")
op("14 专栏管理", "delete", "/admin/columns/{id}/contents/{contentId}", "移除专栏内内容关联", auth="admin", permission="content:write")
crud("15 产品与库存管理", "/admin/products", "产品", "AdminProduct", "ProductCreate", "ProductPatch", "products:write", filters=[STATUS_FILTER, CATEGORY_ID, KEYWORD])
publish_ops("15 产品与库存管理", "/admin/products", "产品", "AdminProduct", "products:write")
paged("15 产品与库存管理", "/admin/products/{id}/skus", "产品全部 SKU", "AdminSku", auth="admin", permission="products:write")
op("15 产品与库存管理", "post", "/admin/products/{id}/skus", "创建 SKU", auth="admin", permission="products:write", body="SkuCreate", data="AdminSku", status=201)
op("15 产品与库存管理", "get", "/admin/skus/{id}", "SKU 详情", auth="admin", permission="products:write", data="AdminSku")
op("15 产品与库存管理", "patch", "/admin/skus/{id}", "修改 SKU", auth="admin", permission="products:write", body="SkuPatch", data="AdminSku")
op("15 产品与库存管理", "delete", "/admin/skus/{id}", "删除未引用 SKU", auth="admin", permission="products:write", params=[query("version", VERSION, True)],
   note="有库存、预占或订单引用则拒绝；历史使用过的 SKU 只能停用。")
op("15 产品与库存管理", "post", "/admin/skus/{id}/stock-adjustments", "调整实物库存", auth="admin", permission="products:write",
   body="StockAdjustmentInput", data="StockAdjustment", status=201, idem=True)
paged("15 产品与库存管理", "/admin/skus/{id}/stock-adjustments", "库存调整记录", "StockAdjustment", auth="admin", permission="products:write", params=DATE_FILTER)
paged("16 订单、物流与售后管理", "/admin/orders", "查询用户订单", "AdminOrderSummary", auth="admin", permission="orders:read",
      params=[query("userId", ID), query("orderNo", string("精确订单号。", "20261022000001")), query("type", ORDER_TYPE),
              query("status", ORDER_STATUS), query("paymentStatus", PAYMENT_STATUS), *DATE_FILTER, SORT_CREATED])
op("16 订单、物流与售后管理", "get", "/admin/orders/{id}", "用户订单详情", auth="admin", permission="orders:read", data="AdminOrder")
op("16 订单、物流与售后管理", "get", "/admin/orders/{id}/logistics", "查询订单物流", auth="admin", permission="orders:read", data="LogisticsResult")
op("16 订单、物流与售后管理", "post", "/admin/orders/{id}/shipment", "订单发货", auth="admin", permission="orders:ship",
   body="ShipmentCreate", data="Shipment", status=201, idem=True,
   note="仅 PENDING_SHIPMENT 且不存在活跃售后／退款；一期一单一包裹，所有剩余未退款行一次发出。使用行锁与售后申请互斥，防止边退款边发货。")
op("16 订单、物流与售后管理", "patch", "/admin/shipments/{id}", "纠正出库物流单号", auth="admin", permission="orders:ship", body="ShipmentPatch", data="Shipment")
paged("16 订单、物流与售后管理", "/admin/aftersales", "查询用户售后", "AfterSale", auth="admin", permission="aftersales:review",
      params=[query("status", AFTERSALE_STATUS), query("orderId", ID), query("userId", ID), *DATE_FILTER])
op("16 订单、物流与售后管理", "get", "/admin/aftersales/{id}", "用户售后详情", auth="admin", permission="aftersales:review", data="AfterSale")
op("16 订单、物流与售后管理", "post", "/admin/aftersales/{id}/review", "批准／驳回售后", auth="admin", permission="aftersales:review",
   body="AfterSaleReview", data="AfterSale", idem=True,
   note="仅 PENDING_REVIEW；REFUND_ONLY 批准后异步退款；RETURN_REFUND 批准后返回退货地址和期限。驳回释放冻结额度。")
op("16 订单、物流与售后管理", "post", "/admin/aftersales/{id}/confirm-return", "验收退货并退款", auth="admin", permission="aftersales:review",
   body="ReturnReceiptInput", data="AfterSale", idem=True,
   note="仅 RETURNING；验收写入审计后转 REFUNDING。退件验收不会自动重新入可售库存；质检后另做入库。")
op("16 订单、物流与售后管理", "post", "/admin/aftersales/{id}/retry-refund", "重试失败退款", auth="admin", permission="aftersales:review",
   body="VersionInput", data="AfterSale", idem=True, note="仅 REFUND_FAILED；重用原 refund.id／渠道退款号并先查单，避免重复退款。")
paged("16 订单、物流与售后管理", "/admin/refunds", "查询退款流水", "Refund", auth="admin", permission="aftersales:review",
      params=[query("orderId", ID), query("status", enum("退款状态。", "PENDING|PROCESSING|SUCCEEDED|FAILED")), *DATE_FILTER])
op("16 订单、物流与售后管理", "post", "/admin/orders/{id}/digital-refund", "数字订单人工全额退款", auth="admin", permission="aftersales:review",
   body="DigitalRefundInput", data="Refund", status=202, idem=True,
   note="仅 COURSE／MEMBERSHIP，且没有其他退款。课程退款成功撤销本次权益；会员仅允许尚未开始的未来完整权益段退款。当前或已消费会员段返回 DIGITAL_REFUND_NOT_ELIGIBLE。")
paged("17 用户与会员管理", "/admin/users", "查询用户及会员状态", "AdminUser", auth="admin", permission="users:read",
      params=[query("userId", ID), query("nickname", string("昵称关键字。", "小雨", maxLength=32)),
              query("status", enum("用户状态。", "ACTIVE|BANNED|DEACTIVATED")), query("hasMembership", boolean("是否有效会员。", True)), *DATE_FILTER])
op("17 用户与会员管理", "get", "/admin/users/{id}", "用户详情及会员信息", auth="admin", permission="users:read", data="AdminUser")
op("17 用户与会员管理", "get", "/admin/users/{id}/membership", "用户会员权益详情", auth="admin", permission="users:read", data="MembershipDetail")
op("17 用户与会员管理", "post", "/admin/users/{id}/ban", "封禁用户", auth="admin", permission="users:ban", body="UserBanInput", data="AdminUser", idem=True)
op("17 用户与会员管理", "post", "/admin/users/{id}/unban", "解除用户封禁", auth="admin", permission="users:ban", body="UserUnbanInput", data="AdminUser", idem=True)
paged("17 用户与会员管理", "/admin/membership-plans", "管理会员方案", "AdminMembershipPlan", auth="admin", permission="membership:write",
      params=[query("enabled", boolean("是否启用。", True))])
op("17 用户与会员管理", "post", "/admin/membership-plans", "创建会员方案（停用）", auth="admin", permission="membership:write", body="MembershipPlanCreate", data="AdminMembershipPlan", status=201)
op("17 用户与会员管理", "get", "/admin/membership-plans/{id}", "会员方案详情", auth="admin", permission="membership:write", data="AdminMembershipPlan")
op("17 用户与会员管理", "patch", "/admin/membership-plans/{id}", "修改／启停会员方案", auth="admin", permission="membership:write", body="MembershipPlanPatch", data="AdminMembershipPlan")
paged("18 站内通知与审计管理", "/admin/notification-tasks", "通知任务列表", "NotificationTask", auth="admin", permission="notifications:write")
op("18 站内通知与审计管理", "post", "/admin/notification-tasks", "创建站内通知任务", auth="admin", permission="notifications:write", body="NotificationTaskInput", data="NotificationTask", status=202, idem=True)
op("18 站内通知与审计管理", "get", "/admin/notification-tasks/{id}", "通知投递结果", auth="admin", permission="notifications:write", data="NotificationTask")
paged("18 站内通知与审计管理", "/admin/audit-logs", "操作审计查询", "AuditLog", auth="admin", permission="audit:read",
      params=[query("actorId", ID), query("action", string("操作名。", "order.ship", maxLength=64)), query("resourceId", ID), *DATE_FILTER])

op("13 分类与内容管理", "get", "/admin/contents/{id}/playback", "预览科普视频（含草稿）", auth="admin", permission="content:write", data="PlaybackGrant",
   note="仅科普视频且素材 READY；允许管理端预览 DRAFT／OFFLINE，不需要客户购买权益，操作审计。")
op("13 分类与内容管理", "get", "/admin/chapters/{id}/playback", "预览视频章节（含草稿）", auth="admin", permission="content:write", data="PlaybackGrant",
   note="仅 VIDEO 章节且素材 READY；允许管理员预览，签发短时授权并审计。")

# Coherent sample values and nullable timestamps in reusable objects.
for name in ("ContentSummary", "ContentDetail", "AdminContent", "ContentCreate", "ContentPatch"):
    SCHEMAS[name]["properties"]["priceCents"] = {**MONEY, "example": 0}
for name in ("ContentSummary", "ContentDetail", "AdminContent"):
    SCHEMAS[name]["properties"]["cover"] = ref("MediaSummary")
for schema in SCHEMAS.values():
    for prop in schema.get("properties", {}).values():
        if prop.get("nullable") and prop.get("format") == "date-time":
            prop["example"] = None
SCHEMAS["MembershipSummary"]["properties"]["expiresAt"]["example"] = "2026-11-21T02:00:00Z"
SCHEMAS["MembershipDetail"]["properties"]["expiresAt"]["example"] = "2026-11-21T02:00:00Z"
SCHEMAS["AdminContent"]["properties"]["publishedAt"] = {**TIME, "nullable": True, "example": None}
SCHEMAS["MediaSummary"]["properties"]["status"] = {**MEDIA_STATUS, "example": "READY"}
SCHEMAS["OrderItem"]["properties"]["refundedAmountCents"] = {**MONEY, "example": 0}
SCHEMAS["PrivateEvidenceMedia"] = copy.deepcopy(SCHEMAS["MediaSummary"])
SCHEMAS["PrivateEvidenceMedia"]["description"] = "售后私有图片元数据；publicUrl 固定 null，须申请 read-grant。"
SCHEMAS["PrivateEvidenceMedia"]["properties"]["publicUrl"] = {"type": "string", "nullable": True, "enum": [None], "description": "固定 null。", "example": None}
SCHEMAS["AfterSale"]["properties"]["evidence"] = array("PrivateEvidenceMedia", "售后凭证；不提供永久公开 URL")
for name in ("Sku", "AdminSku", "SkuCreate", "SkuPatch", "MembershipPlan", "AdminMembershipPlan", "MembershipPlanCreate", "MembershipPlanPatch"):
    SCHEMAS[name]["properties"]["priceCents"]["minimum"] = 1
for field in ("minPriceCents", "maxPriceCents"):
    for name in ("ProductSummary", "ProductDetail", "AdminProduct"):
        SCHEMAS[name]["properties"][field]["minimum"] = 1
task_fields = SCHEMAS["NotificationTaskInput"]["properties"]
obj("NotificationUsersInput", "向指定用户发送站内通知。", {
    **task_fields, "audience": enum("指定用户。", "USERS")})
obj("NotificationAllInput", "任务创建时对活跃用户取接收者快照；不允许 userIds。", {
    **{k: v for k, v in task_fields.items() if k != "userIds"}, "audience": enum("全部活跃用户。", "ALL_ACTIVE")})
union("NotificationTaskInput", "通知范围二选一。", ["NotificationUsersInput", "NotificationAllInput"], "audience")

# Implemented physical-commerce contract. Digital goods and external providers remain planned.
for _path, _methods in {
    '/admin/auth/login': ['post'], '/admin/auth/refresh': ['post'], '/admin/auth/logout': ['post'], '/admin/me': ['get'],
    '/me/addresses': ['get', 'post'], '/me/addresses/{id}': ['get', 'put', 'delete'],
    '/categories': ['get'], '/products': ['get'], '/products/{id}': ['get'],
    '/admin/categories': ['get', 'post'], '/admin/categories/{id}': ['get', 'patch', 'delete'],
    '/admin/products': ['get', 'post'], '/admin/products/{id}': ['get', 'patch', 'delete'],
    '/admin/products/{id}/publish': ['post'], '/admin/products/{id}/unpublish': ['post'],
    '/admin/products/{id}/skus': ['get', 'post'], '/admin/skus/{id}': ['get', 'patch', 'delete'],
    '/admin/skus/{id}/stock-adjustments': ['get', 'post'],
    '/order-quotes': ['post'], '/orders': ['get', 'post'], '/orders/{id}': ['get'],
    '/orders/{id}/cancel': ['post'], '/orders/{id}/confirm-receipt': ['post'],
    '/orders/{id}/logistics': ['get'], '/orders/{id}/refunds': ['get'],
    '/aftersales': ['get', 'post'], '/aftersales/{id}': ['get'],
    '/aftersales/{id}/cancel': ['post'], '/aftersales/{id}/return-shipment': ['post'],
    '/admin/orders': ['get'], '/admin/orders/{id}': ['get'], '/admin/orders/{id}/logistics': ['get'],
    '/admin/orders/{id}/shipment': ['post'], '/admin/shipments/{id}': ['patch'],
    '/admin/aftersales': ['get'], '/admin/aftersales/{id}': ['get'],
    '/admin/aftersales/{id}/review': ['post'], '/admin/aftersales/{id}/confirm-return': ['post'],
    '/admin/aftersales/{id}/retry-refund': ['post'], '/admin/refunds': ['get'],
}.items():
    IMPLEMENTED.update((_method, _path) for _method in _methods)

obj('ProductImageCreate', '登记管理员已托管的公开 HTTPS 产品图片；不抓取远程文件、不提供文件上传或私有凭证存储。', {
    'publicUrl': string('HTTPS 公开图片地址，不得含用户名或密码。', 'https://example.com/product.jpg', format='uri', maxLength=2048),
    'mimeType': enum('管理员登记的图片 MIME。', 'image/jpeg|image/png|image/webp'),
    'sizeBytes': integer('管理员登记的文件大小。', 1024, 1, maximum=20971520)})
obj('TestPaymentInput', '仅测试环境且 COMMERCE_TEST_PAYMENTS=true；金额取订单，不发生真实扣款。', {
    'version': VERSION, 'transactionNo': string('测试流水号，全局唯一。', 'test_payment_001', pattern=r'^[A-Za-z0-9_-]{1,64}$')})
obj('TestRefundInput', '管理员模拟退款结果；version 为售后单当前版本，不发生真实转账。', {
    'version': VERSION, 'result': enum('测试结果。', 'SUCCEEDED|FAILED')})
obj('ManualLogisticsInput', '人工登记物流事件，记录操作者；不是快递平台的自动查询结果。', {
    'version': VERSION, 'status': enum('物流状态。', 'IN_TRANSIT|OUT_FOR_DELIVERY|DELIVERED|EXCEPTION'),
    'time': TIME, 'description': string('人工确认的物流说明。', '管理员登记揽收', minLength=1, maxLength=500),
    'location': string('位置。', '上海', minLength=1, maxLength=100)}, ['version', 'status', 'time', 'description'])
obj('ShipmentLine', '发出的剩余未退款商品快照。', {'orderItemId': ID, 'quantity': QTY})
obj('CommerceAuditLog', '交易变更及敏感详情读取的审计记录；不含密码和令牌。', {
    'id': ID, 'actorKey': string('user/admin/system 前缀和操作者 ID。', 'admin:id_10001'),
    'action': string('操作。', 'order.ship'), 'resourceId': ID,
    'details': {'type': 'object', 'additionalProperties': True, 'description': '最小必要操作信息。', 'example': {}}, 'createdAt': TIME})

op('15 产品与库存管理', 'post', '/admin/product-images', '登记公开产品图片', auth='admin', permission='products:write', body='ProductImageCreate', data='MediaSummary', status=201)
op('16 订单、物流与售后管理', 'post', '/admin/orders/{id}/test-payment', '测试确认订单付款', auth='admin', permission='payments:test', body='TestPaymentInput', data='AdminOrder', idem=True,
   note='仅显式启用的 development/test/staging 环境。生产环境总是拒绝。订单须未过期且待支付；测试流水唯一，无真实资金流。')
op('16 订单、物流与售后管理', 'post', '/admin/refunds/{id}/test-result', '测试确认退款结果', auth='admin', permission='payments:test', body='TestRefundInput', data='Refund', idem=True,
   note='version 为售后单版本。只允许 TEST 支付的 PROCESSING 退款。成功才更新金额、售后数量和未发货预占库存；失败维持冻结。')
op('16 订单、物流与售后管理', 'post', '/admin/shipments/{id}/events', '登记人工物流轨迹', auth='admin', permission='orders:ship', body='ManualLogisticsInput', data='Shipment', idem=True,
   note='必须遵守物流状态顺序，时间不得早于发货或已有最新事件。签收不等于用户确认收货；人工记录不更新 lastSyncedAt。')
paged('16 订单、物流与售后管理', '/admin/commerce-audit-logs', '交易审计日志', 'CommerceAuditLog', auth='admin', permission='audit:read')
for _method, _path in [('post', '/admin/product-images'), ('post', '/admin/orders/{id}/test-payment'),
                      ('post', '/admin/refunds/{id}/test-result'), ('post', '/admin/shipments/{id}/events'), ('get', '/admin/commerce-audit-logs')]:
    IMPLEMENTED.add((_method, _path))

SCHEMAS['CategoryCreate']['properties']['scope'] = enum('当前仅支持产品分类。', 'PRODUCT')
SCHEMAS['AdminProduct']['properties']['skus'] = array('AdminSku', '含停用 SKU 和管理库存字段')
for _field in ('minPriceCents', 'maxPriceCents'):
    SCHEMAS['AdminProduct']['properties'][_field] = {**MONEY, 'minimum': 0, 'description': '启用 SKU 价格范围；无启用 SKU 的草稿返回 0。'}
for _name in ('SkuCreate', 'SkuPatch', 'Sku', 'AdminSku'):
    SCHEMAS[_name]['properties']['priceCents'] = {**MONEY, 'minimum': 1, 'maximum': 100000000}
SCHEMAS['StockAdjustment']['properties'].update({
    'reservedDelta': {'type': 'integer', 'description': '预占变化；业务自动预占／释放也记流水。', 'example': 0},
    'orderId': {**ID, 'nullable': True, 'example': None}})
SCHEMAS['StockAdjustment']['required'] += ['reservedDelta', 'orderId']
SCHEMAS['Shipment']['properties']['items'] = array('ShipmentLine', '实际发货行与数量')
SCHEMAS['Shipment']['required'].append('items')
SCHEMAS['LogisticsEvent']['properties']['source'] = enum('人工记录来源。', 'MANUAL')
SCHEMAS['LogisticsEvent']['required'].append('source')
SCHEMAS['LogisticsResult']['properties']['syncStatus'] = enum('当前未发货为 NOT_SHIPPED，发货后为 MANUAL；其他值预留外部物流适配器。', 'NOT_SHIPPED|MANUAL|UP_TO_DATE|PENDING|FAILED')
SCHEMAS['LogisticsResult']['properties']['shipment'] = {**copy.deepcopy(SCHEMAS['Shipment']), 'nullable': True}
SCHEMAS['AfterSaleCreate']['properties']['evidenceMediaIds']['description'] = '当前私有存储未配置，仅允许省略或空数组；非空返回 503 EVIDENCE_STORAGE_UNAVAILABLE。'
SCHEMAS['AdminAuthTokens']['description'] = '独立管理员会话，aud=admin；访问令牌默认 15 分钟，刷新会话绝对期限 24 小时。'
for _operation in OPERATIONS:
    if _operation['path'] == '/order-quotes':
        _operation['body'] = 'ProductPurchase'
        _operation['title'] = '实物商品下单试算'
        _operation['note'] = '当前仅 PRODUCT，10 分钟有效，不占库存；服务端计算价格，当前免运费。快照绑定用户，数字商品后续接入。'
    if _operation['path'] == '/orders' and _operation['method'] == 'post':
        _operation['note'] = '一份报价最多一单。下单重查产品状态、SKU 价格和规格、库存；价格或规格改变返回 QUOTE_CHANGED，须重新试算。事务预占库存，待付款 30 分钟到期释放。'
    if _operation['path'] == '/categories':
        _operation['params'][2]['schema'] = enum('当前仅产品分类。', 'PRODUCT')
        _operation['params'][2]['required'] = False
        _operation['note'] = '当前仅 PRODUCT 分类，parentId 可过滤直接子分类。'
    if _operation['path'] in ('/orders', '/admin/orders') and _operation['method'] == 'get':
        _operation['params'].append(query('afterSaleStatus', enum('售后汇总。', 'NONE|PROCESSING|PARTIALLY_COMPLETED|COMPLETED')))
    if _operation['path'] in ('/orders/{id}/logistics', '/admin/orders/{id}/logistics'):
        _operation['note'] = '未发货返回空包裹；已发货返回人工登记物流，syncStatus=MANUAL，lastSyncedAt=null。尚未接入第三方快递查询。'
    if _operation['path'] == '/admin/aftersales/{id}/retry-refund':
        _operation['note'] = '仅 REFUND_FAILED，重用原 refund.id。当前 TEST 支付不调用外部渠道；接入真实退款时必须先查单。'
    if _operation['path'] == '/orders/{id}/cancel':
        _operation['note'] = '仅本人待付款订单，与测试付款抢同一订单锁；取消成功释放预占。当前无外部支付单。'
    if _operation['path'] in ('/admin/products/{id}', '/admin/skus/{id}') and _operation['method'] == 'delete':
        _operation['note'] = '禁止删除有历史库存、报价或订单引用的 SKU；产品仅可删除无 SKU 的草稿。业务历史保留，已使用资源改为下架或停用。'

from content_contract import apply_content_contract, finalize_content_spec
apply_content_contract(globals())

AUTH_LABELS = {
    "public": ("否", "否"), "optional": ("可选", "否"), "user": ("是", "否"),
    "admin": ("是", "是"), "admin_login": ("否", "是（管理员凭证）"), "authenticated": ("是（用户或管理员）", "按操作与素材用途"),
    "refresh": ("否（需刷新令牌）", "否"), "admin_refresh": ("否（需管理员刷新令牌）", "是"),
    "webhook": ("否（需渠道验签）", "否"),
}

ERRORS = [
    (400, "VALIDATION_ERROR", "DTO、Query 或 Path 参数不合法", "根据 error.details 标记字段"),
    (400, "SMS_CODE_INVALID", "验证码无效、过期、用途不符或超过尝试次数", "重新获取对应用途验证码"),
    (400, "MEDIA_NOT_READY", "素材未完成处理或用途／类型不匹配", "轮询素材状态或重新上传"),
    (401, "AUTH_REQUIRED", "缺少登录令牌", "进入登录"),
    (401, "AUTH_INVALID_CREDENTIALS", "账号或密码错误", "统一提示，避免账号枚举"),
    (401, "TOKEN_EXPIRED", "访问令牌过期", "单飞刷新后最多重放一次"),
    (401, "TOKEN_INVALID", "令牌错误、会话撤销或 audience 不符", "清理对应端会话"),
    (401, "REFRESH_TOKEN_INVALID", "刷新令牌无效或过期", "重新登录"),
    (401, "REFRESH_TOKEN_REUSED", "已轮换刷新令牌被重放", "撤销该会话链并重新登录"),
    (403, "ACCOUNT_BANNED", "账号封禁中", "显示封禁提示，停止刷新"),
    (403, "ADMIN_REQUIRED", "管理接口使用了客户端身份", "使用管理员登录"),
    (403, "PERMISSION_DENIED", "缺少指定管理权限", "隐藏相应操作"),
    (403, "CONTENT_ACCESS_DENIED", "未购买且无适用会员权益", "显示购买／会员入口"),
    (404, "RESOURCE_NOT_FOUND", "不存在、不可见或不属于当前用户", "统一显示资源不可用"),
    (409, "PHONE_ALREADY_REGISTERED", "注册手机号已存在", "引导登录或重置密码"),
    (409, "PROTOCOL_VERSION_CHANGED", "提交的协议版本已更新", "重新展示当前协议再提交"),
    (409, "VERSION_CONFLICT", "资源已被他人更新", "重取详情，展示最新状态"),
    (409, "IDEMPOTENCY_CONFLICT", "同幂等键对应不同请求内容", "为新的业务意图生成新键"),
    (409, "IDEMPOTENCY_IN_PROGRESS", "同幂等操作仍处理中", "按 Retry-After 用同键重试"),
    (409, "QUOTE_EXPIRED", "试算已过期", "重新试算并让用户确认新金额"),
    (409, "OUT_OF_STOCK", "库存不足", "重取产品与库存"),
    (409, "RESOURCE_NOT_SELLABLE", "产品、SKU、课程或会员方案已停售", "重取资源"),
    (409, "COURSE_ALREADY_PURCHASED", "已有该课程有效独立购买权益", "直接进入已购课程"),
    (409, "ORDER_STATE_INVALID", "订单当前状态不允许该操作", "重取订单和 actions"),
    (409, "PAYMENT_EXPIRED", "订单或支付尝试已过期", "重取订单，必要时重新下单"),
    (409, "AFTERSALE_NOT_ELIGIBLE", "申请时间、订单类型或状态不符合规则", "重取售后资格"),
    (409, "AFTERSALE_IN_PROGRESS", "同一订单存在另一张活跃售后单", "先完成或撤销原申请"),
    (409, "AFTERSALE_QUANTITY_EXCEEDED", "申请数量已被其他售后占用或已退款", "重取订单和售后"),
    (409, "AFTERSALE_STATE_INVALID", "售后状态不允许该操作", "重取售后"),
    (409, "DIGITAL_REFUND_NOT_ELIGIBLE", "不是可退款的数字订单或会员权益段已开始", "转人工核对业务政策"),
    (409, "RESOURCE_IN_USE", "素材、分类或其他对象仍被引用", "先处理引用／下架"),
    (409, "STOCK_CONFLICT", "库存调整会使实物库存低于预占", "重取库存与版本"),
    (409, "AI_GENERATION_IN_PROGRESS", "会话存在活跃生成任务", "等待完成或取消"),
    (410, "STREAM_CURSOR_EXPIRED", "SSE 重放窗口已过期", "读取任务和历史消息恢复"),
    (413, "PAYLOAD_TOO_LARGE", "请求体或文件超过限制", "减小正文或文件"),
    (415, "UNSUPPORTED_MEDIA_TYPE", "文件实际类型不受支持", "更换允许的格式"),
    (429, "RATE_LIMITED", "短信、登录、支付补查等请求过频", "遵循 Retry-After"),
    (429, "AI_QUOTA_EXCEEDED", "今日问答次数不足", "展示额度与恢复时间"),
    (500, "INTERNAL_ERROR", "服务端未预期错误", "携带 requestId 联系支持"),
    (503, "DEPENDENCY_UNAVAILABLE", "短信、存储、支付等依赖暂不可用", "幂等写入使用同键重试"),
    (503, "AI_PROVIDER_UNAVAILABLE", "模型供应商暂不可用", "提示稍后再试；检查额度归还"),
]


def sample(schema, depth=0):
    if depth > 14:
        raise ValueError("Recursive schema needs an explicit example")
    if "$ref" in schema:
        return sample(SCHEMAS[schema["$ref"].rsplit("/", 1)[1]], depth + 1)
    if "example" in schema:
        return copy.deepcopy(schema["example"])
    if schema.get("nullable"):
        return None
    if "oneOf" in schema:
        return sample(schema["oneOf"][0], depth + 1)
    if "enum" in schema:
        return schema["enum"][0]
    if schema.get("type") == "object":
        values = {k: sample(v, depth + 1) for k, v in schema.get("properties", {}).items()
                  if k in schema.get("required", [])}
        for k, v in schema.get("properties", {}).items():
            if len(values) >= schema.get("minProperties", 0):
                break
            if k not in values:
                values[k] = sample(v, depth + 1)
        return values
    if schema.get("type") == "array":
        return [sample(schema["items"], depth + 1)] if schema.get("maxItems", 1) > 0 else []
    if schema.get("type") == "boolean":
        return False
    if schema.get("type") == "integer":
        return schema.get("minimum", 0)
    if schema.get("type") == "string":
        return "example"
    return {}


def success_schema(data):
    return {"type": "object", "additionalProperties": False,
            "required": ["code", "message", "data", "requestId", "timestamp"], "properties": {
                "code": enum("成功码。", "OK"), "message": string("提示。", "success"),
                "data": ref(data), "requestId": string("追踪号。", "req_demo_001"), "timestamp": TIME}}


def path_parameters(operation):
    import re
    results = []
    for name in re.findall(r"\{([^}]+)\}", operation["path"]):
        schema = ID
        if name == "provider":
            schema = enum("支付渠道；只对接已经配置的商户协议。", "wechat|alipay")
        elif name == "type" and "legal-documents" in operation["path"]:
            schema = enum("协议类型。", "TERMS|PRIVACY")
        results.append({"in": "path", "name": name, "required": True,
                        "description": schema["description"], "schema": schema})
    return results


def operation_id(operation):
    import re
    return operation["method"] + "_" + re.sub(r"[^a-zA-Z0-9]+", "_", operation["path"]).strip("_")


def make_spec():
    spec = {
        "openapi": "3.0.3",
        "info": {"title": "两性健康服务平台 API", "version": "1.3.0",
                 "description": "已实现用户与管理员认证、产品、实物订单、人工物流、售后和测试收付款。x-implementation-status 表示仓库实现状态；线上可用范围以部署版本为准。短信及外部支付／物流暂未接入。"},
        "servers": [{"url": "http://localhost:3000/api/v1", "description": "本地开发（示例）"},
                    {"url": "http://47.97.46.242/api/v1", "description": "staging 测试服务；可用接口以部署版本为准，协议版本以接口返回值为准"},
                    {"url": "https://api.example.com/api/v1", "description": "生产域名占位，必须替换"}],
        "tags": [{"name": t} for t in dict.fromkeys(o["tag"] for o in OPERATIONS)],
        "components": {"schemas": SCHEMAS, "securitySchemes": {
            "ClientBearer": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT", "description": "aud=client；管理接口不接受。"},
            "AdminBearer": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT", "description": "aud=admin；还要检查 x-permissions。"}}},
        "paths": {},
    }
    for operation in OPERATIONS:
        auth = operation["auth"]
        security = []
        if auth == "user":
            security = [{"ClientBearer": []}]
        elif auth == "admin":
            security = [{"AdminBearer": []}]
        elif auth == "optional":
            security = [{}, {"ClientBearer": []}]
        elif auth == "authenticated":
            security = [{"ClientBearer": []}, {"AdminBearer": []}]
        parameters = [*path_parameters(operation), *copy.deepcopy(operation["params"])]
        if auth != "webhook":
            parameters.append({"in": "header", "name": "X-Request-ID", "required": False,
                               "schema": string("追踪号；服务端校验后回传或重新生成。", "req_demo_001", minLength=1, maxLength=64, pattern=r"^[A-Za-z0-9_-]{1,64}$")})
        if operation["idem"]:
            parameters.append({"in": "header", "name": "Idempotency-Key", "required": True,
                               "schema": string("同一业务意图重试复用；当前持久保存，同键不同路径或请求体返回 409。", "74ed8e82-ce32-4bc6-baf4-1fbfe691ae4a", minLength=16, maxLength=64, pattern=r"^[A-Za-z0-9_-]{16,64}$")})
        if operation["response_kind"] == "sse":
            parameters.append({"in": "header", "name": "Last-Event-ID", "required": False,
                               "schema": string("同 generation 内上次已消费事件序号。", "2", pattern=r"^\d+$")})
        record = {"operationId": operation_id(operation), "summary": operation["title"],
                  "description": operation["note"] or operation["title"], "tags": [operation["tag"]],
                  "security": security, "parameters": parameters,
                  "x-implementation-status": implementation_status(operation),
                  "x-login-required": auth in ("user", "admin", "authenticated"),
                  "x-admin-required": auth in ("admin", "admin_refresh", "admin_login"),
                  "x-auth-mode": auth, "x-permissions": [operation["permission"]] if operation["permission"] else [],
                  "x-idempotency-required": operation["idem"]}
        if auth == "authenticated":
            admin_permission = "aftersales:review" if operation["path"].endswith("/read-grant") else "media:write"
            record["x-conditional-permissions"] = {"client": [], "admin": [admin_permission]}
        if operation["body"]:
            if auth == "webhook":
                content = {"application/json": {"schema": ref(operation["body"])},
                           "application/x-www-form-urlencoded": {"schema": ref(operation["body"])}}
            else:
                content = {"application/json": {"schema": ref(operation["body"]), "example": sample(ref(operation["body"]))}}
            record["requestBody"] = {"required": True, "content": content}
        if operation["response_kind"] == "provider":
            record["x-external-contract"] = "商户选择的支付／退款通知协议；签名头、载荷和 ACK 在渠道适配器中按该协议确定。"
            record["responses"] = {
                "200": {"description": "验签并可靠落库后按渠道协议 ACK；不使用平台 JSON 外壳。",
                        "content": {"application/json": {"schema": {"type": "object", "additionalProperties": True}},
                                    "text/plain": {"schema": {"type": "string"}}}},
                "400": {"description": "非法通知；按渠道协议拒绝。"},
                "401": {"description": "签名验证失败；按渠道协议拒绝。"},
                "500": {"description": "未可靠落库；返回失败使渠道重试。"}}
        else:
            if operation["response_kind"] == "sse":
                content = {"text/event-stream": {"schema": {"type": "string"},
                            "example": 'id: 1\nevent: meta\ndata: {"generationId":"gen_10001","assistantMessageId":"msg_10002"}\n\n'}}
            else:
                envelope = success_schema(operation["data"])
                content = {"application/json": {"schema": envelope, "example": sample(envelope)}}
            record["responses"] = {str(operation["status"]): {
                "description": "成功；data 类型见 schema。" if operation["response_kind"] == "json" else "持续推送生成事件。",
                "headers": {"X-Request-ID": {"schema": {"type": "string"}, "description": "请求追踪号。"}},
                "content": content}}
            for status in sorted({e[0] for e in ERRORS}):
                record["responses"][str(status)] = {"description": "参见业务错误码表。",
                    "content": {"application/json": {"schema": ref("ErrorResponse")}}}
        spec["paths"].setdefault(operation["path"], {})[operation["method"]] = record
    finalize_content_spec(spec)
    return spec


def type_label(schema):
    if "$ref" in schema:
        return schema["$ref"].rsplit("/", 1)[1]
    if "oneOf" in schema:
        return " / ".join(type_label(s) for s in schema["oneOf"])
    if schema.get("type") == "array":
        return type_label(schema["items"]) + "[]"
    return schema.get("type", "object") + (" / null" if schema.get("nullable") else "")


def cell(text):
    return str(text).replace("|", " / ").replace("\n", " ")


def constraints(schema):
    parts = []
    for key, label in [("enum", "枚举"), ("format", "格式"), ("minimum", "最小"), ("maximum", "最大"),
                       ("minLength", "最短"), ("maxLength", "最长"), ("minItems", "最少项"),
                       ("maxItems", "最多项"), ("pattern", "正则"), ("default", "默认")]:
        if key in schema:
            value = ", ".join(str(v) for v in schema[key]) if key == "enum" else schema[key]
            parts.append(f"{label}: `{cell(value)}`")
    if schema.get("uniqueItems"):
        parts.append("元素不重复")
    return "；".join(parts)


def schema_link(name):
    return f"[{name}](02-data-models.md#{name.lower()})" if name else "—"


def build_api_markdown():
    lines = ["# 接口文档", "", "> 更新：2026-10-25。认证、实物交易、科普、付费课程与专栏已实现；线上范围以部署版本为准。短信、会员及第三方服务暂缓。",
             "", "已实现接口的运行方法见 [后端启动与数据库](04-backend-auth.md)。",
             "", "测试 API：`http://47.97.46.242/api/v1`。详见 [交易模块](06-commerce.md)、[科普与课程](08-content-courses.md) 与 [部署说明](05-deployment.md)。",
             "注册示例采用本地默认协议版本 `2026-10-01`；公网测试环境当前为 `2026-10-23-test`，提交前须读取当前环境的协议接口。",
             "", "所有下列 URL 统一加前缀 `/api/v1`。请求默认 `application/json`；返回默认使用统一响应结构，表中的响应类型指 `data`。",
             "请求及响应对象的全部字段见 [数据格式文档](02-data-models.md)，状态与联调步骤见 [业务流程文档](03-business-flows.md)。",
             "", "“可选登录”表示可不传 token；如已传入，则必须有效。管理员接口必须使用独立管理员 token 并具备表中权限。`Path` 参数均为必填字符串，特殊枚举已在参数说明中列出。",
             "", "分页列表未注明时按 `createdAt,id` 降序。`page` 默认 1，`pageSize` 默认 20、最大 100；排序与过滤参数只接受文档列出的值。", "",
             "## 模块索引", ""]
    tags = list(dict.fromkeys(o["tag"] for o in OPERATIONS))
    for tag in tags:
        lines.append(f"- [{tag}](#module-{tag[:2]})")
    for tag in tags:
        lines += ["", f'<a id="module-{tag[:2]}"></a>', f"## {tag}", "",
                  "| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |",
                  "|---|---|---|---|---|---|---|---|---|---|"]
        group = [o for o in OPERATIONS if o["tag"] == tag]
        for o in group:
            no = OPERATIONS.index(o) + 1
            login, admin = AUTH_LABELS[o["auth"]]
            response = schema_link(o["data"]) if o["response_kind"] == "json" else ("SSE 事件" if o["response_kind"] == "sse" else "渠道协议 ACK")
            permission = o["permission"] or "—"
            if o["auth"] == "authenticated":
                permission = "管理员: " + ("aftersales:review" if o["path"].endswith("/read-grant") else "media:write")
            lines.append(f"| [A{no:03}](#a{no:03}) | {o['title']} | `{o['method'].upper()}` | `{o['path']}` | {login} | {admin} | `{permission}` | {schema_link(o['body'])} | {response} | {o['status']} |")
        lines += ["", "### 参数与业务约束", ""]
        for o in group:
            no = OPERATIONS.index(o) + 1
            lines += [f'<a id="a{no:03}"></a>', f"#### A{no:03} {o['title']}", "", f"`{o['method'].upper()} /api/v1{o['path']}`", ""]
            labels = {'implemented': '已实现', 'deferred': '暂缓实现（当前返回 404）', 'planned': '设计中（尚未实现）'}
            lines += [f"**实现状态：** {labels[implementation_status(o)]}", ""]
            if o["note"]:
                lines += [o["note"], ""]
            if o["idem"]:
                lines += ["**必填请求头：** `Idempotency-Key`，16–128 位字母、数字、下划线或连字符；相同业务意图重试复用。", ""]
            params = [*path_parameters(o), *o["params"]]
            if o["response_kind"] == "sse":
                params.append({"in": "header", "name": "Last-Event-ID", "required": False,
                               "schema": string("已消费的最后事件序号。", "2", pattern=r"^\d+$")})
            if params:
                lines += ["| 位置 | 名称 | 类型 | 必填 | 说明与约束 |", "|---|---|---|---|---|"]
                for p in params:
                    s = p["schema"]
                    lines.append(f"| {p['in']} | `{p['name']}` | {type_label(s)} | {'是' if p['required'] else '否'} | {cell(s.get('description', ''))} {constraints(s)} |")
                lines.append("")
            if o["body"]:
                lines += [f"请求体：{schema_link(o['body'])}，完整字段及必填规则见对应对象。", ""]
            if not params and not o["body"]:
                lines += ["无额外参数或请求体。", ""]
            if o["response_kind"] == "json":
                lines += [f"成功：HTTP `{o['status']}`，`data` 为 {schema_link(o['data'])}。", ""]
    lines += ["## 通用失败响应", "", "所有平台 JSON API 失败返回 [ErrorResponse](02-data-models.md#errorresponse)。HTTP 状态与业务码对应如下；鉴权、参数校验、依赖失败等均按此约定。", "",
              "| HTTP | code | 含义 | 前端处理 |", "|---|---|---|---|"]
    lines += [f"| {status} | `{code}` | {meaning} | {action} |" for status, code, meaning, action in ERRORS]
    lines += ["", "例外：SSE 在建立前返回统一 JSON 错误，建立后通过 `event: error` 报错；支付渠道回调按渠道 ACK 协议回应。对象存储直传响应也不属于平台 JSON API。", ""]
    return "\n".join(lines)


def build_data_markdown():
    lines = ["# 数据格式文档", "", "> 所有名称对应 OpenAPI `components.schemas`，可生成前端 TypeScript 类型与 NestJS DTO。",
             "", "## 基础约定", "",
             "| 项目 | 约定 |", "|---|---|",
             "| ID | `string`，1–64 位，不转 JS Number，不通过 ID 推断权限 |",
             "| 金额 | `integer` 人民币分，`currency=CNY`；如 9900 = ¥99.00；不传浮点金额 |",
             "| 时间 | ISO 8601 UTC，如 `2026-10-22T02:00:00Z`；界面显示上海时间 |",
             "| 分页 | `page/pageSize` 从 1 开始；数据为 `items/total/page/pageSize/hasNext`；空列表为 `[]` |",
             "| 游标 | AI 消息用 `cursor/limit`，`nextCursor=null` 表示结束 |",
             "| 空值 | 非必填字段可省略；只有标注 nullable 的字段可为 `null`；数组无值为 `[]` |",
             "| PATCH | 未传字段保持不变；仅允许标注 nullable 的字段显式清空；管理员修改须带 version |",
             "| 校验 | 未声明的 Body/Query 字段拒绝；枚举区分大小写；Query 中 boolean 仅接受 `true/false` |",
             "| 文本 | 用户消息、通知纯文本；介绍和正文 HTML 由服务端清洗，禁止脚本、事件属性及任意 iframe |",
             "| version | 每次资源写入加 1；`WHERE id=? AND version=?` 更新，冲突返回 409 |", "",
             "## 统一成功结构", "", "```json", json.dumps(sample(success_schema("ActionResult")), ensure_ascii=False, indent=2), "```", "",
             "所有成功 JSON API 返回 `code/message/data/requestId/timestamp`；成功 `code=OK`。创建通常 201，异步受理 202，普通查询／操作 200。删除也返回 200 和 `{success:true}`。", "",
             "## 统一失败结构", "", "```json", json.dumps({"code": "VALIDATION_ERROR", "message": "请求参数不合法", "data": None,
                 "error": {"details": [{"field": "items[0].quantity", "reason": "必须大于等于 1"}]}, "requestId": "req_demo_001", "timestamp": "2026-10-22T02:00:00Z"}, ensure_ascii=False, indent=2), "```", "",
             "失败时 `data=null` 且有 `error.details`；非字段错误时 details 为 []。前端用 HTTP 与 code 决策，message 只用于展示。限流同时返回 `Retry-After` 与可选 retryAfterSeconds。", "",
             "## 对象索引", ""]
    lines += [f"- [{name}](#{name.lower()})" for name in SCHEMAS]
    for name, schema in SCHEMAS.items():
        lines += ["", f'<a id="{name.lower()}"></a>', f"## {name}", "", schema.get("description", ""), ""]
        if "oneOf" in schema:
            lines += ["仅允许以下一种结构：", ""]
            lines += [f"- [{type_label(v)}](#{type_label(v).lower()})" for v in schema["oneOf"]]
            lines.append("")
            continue
        lines += ["| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |", "|---|---|---|---|---|"]
        for field, prop in schema.get("properties", {}).items():
            label = type_label(prop)
            linked_name = prop.get("$ref") or prop.get("items", {}).get("$ref")
            if linked_name:
                label = f"[{label}](#{linked_name.rsplit('/', 1)[1].lower()})"
            desc = prop.get("description", "见关联对象。")
            lines.append(f"| `{field}` | {label} | {'是' if field in schema.get('required', []) else '否'} | {cell(desc)} | {constraints(prop)} |")
        if schema.get("minProperties"):
            lines += ["", f"对象至少包含 {schema['minProperties']} 个字段（包含 version 时，至少另传一个可修改字段）。"]
        if schema.get("additionalProperties") is True:
            lines += ["", "此对象为外部协议载荷，允许渠道定义的额外字段。"]
        elif isinstance(schema.get("additionalProperties"), dict):
            lines += ["", "允许额外键，值类型见 OpenAPI。"]
        lines += ["", "示例（仅结构示意，不作为可用业务 ID）：", "", "```json", json.dumps(sample(schema), ensure_ascii=False, indent=2), "```", ""]
    return "\n".join(lines)


def finish_examples():
    for name, scope in (("ContentCategory", "CONTENT"), ("ProductCategory", "PRODUCT")):
        SCHEMAS[name] = copy.deepcopy(SCHEMAS["Category"])
        SCHEMAS[name]["description"] = f"作用域固定为 {scope} 的分类。"
        SCHEMAS[name]["properties"]["scope"] = enum("固定作用域。", scope)
    for name in ("ContentSummary", "ContentDetail", "AdminContent"):
        SCHEMAS[name]["properties"]["category"] = ref("ContentCategory")
    for name in ("ProductSummary", "ProductDetail", "AdminProduct"):
        SCHEMAS[name]["properties"]["category"] = ref("ProductCategory")
    SCHEMAS["CourseSummary"] = copy.deepcopy(SCHEMAS["ContentSummary"])
    SCHEMAS["CourseSummary"]["description"] = "已购课程摘要，仅付费课程类型；不含授权正文。"
    SCHEMAS["CourseSummary"]["properties"]["kind"] = enum("课程类型。", "VIDEO_COURSE|ARTICLE_COURSE")
    SCHEMAS["CourseSummary"]["properties"]["priceCents"] = {**MONEY, "minimum": 0}
    SCHEMAS["CourseSummary"]["properties"]["accessPolicy"] = enum("课程当前访问策略；编辑价格不会改写历史订单。", "FREE|PURCHASE")
    SCHEMAS["CourseSummary"]["properties"]["chapterCount"]["example"] = 1
    SCHEMAS["CourseEntitlement"]["properties"]["course"] = ref("CourseSummary")
    for name, fields in {"OrderDetail": ["cancelReason", "closedReason"],
                         "AdminOrder": ["cancelReason", "closedReason"], "AdminUser": ["banReason"],
                         "PaymentAttempt": [], "Refund": ["failureCode"], "AiGeneration": ["errorCode"],
                         "AfterSale": ["reviewNote", "refundId"], "AdminBody": ["videoMediaId"]}.items():
        for field in fields:
            SCHEMAS[name]["properties"][field]["example"] = None
    for name, field, value in [
        ("AuthTokens", "refreshExpiresAt", "2026-11-21T02:00:00Z"),
        ("AdminAuthTokens", "refreshExpiresAt", "2026-10-29T02:00:00Z"),
        ("PlaybackGrant", "expiresAt", "2026-10-22T02:05:00Z"),
        ("MediaReadGrant", "expiresAt", "2026-10-22T02:05:00Z"),
        ("UploadTicket", "expiresAt", "2026-10-22T02:10:00Z"),
        ("OrderQuote", "expiresAt", "2026-10-22T02:10:00Z"),
        ("PaymentAttempt", "expiresAt", "2026-10-22T02:30:00Z"),
        ("AiQuota", "resetsAt", "2026-10-22T16:00:00Z"),
    ]:
        SCHEMAS[name]["properties"][field]["example"] = value
    for name in ("OrderSummary", "OrderDetail", "AdminOrder", "AdminOrderSummary"):
        SCHEMAS[name]["properties"]["paymentDeadlineAt"]["example"] = "2026-10-22T02:30:00Z"
    for name in ("OrderQuote", "OrderDetail", "AdminOrder"):
        example = sample(SCHEMAS[name])
        example["address"] = sample(ref("AddressSnapshot"))
        SCHEMAS[name]["example"] = example
    SCHEMAS["LogisticsResult"]["example"] = {"shipment": None, "events": [], "syncStatus": "NOT_SHIPPED"}


def validate_value(value, schema, location="value"):
    """Validate generated examples against this contract's schema subset."""
    import datetime
    import re
    from urllib.parse import urlparse
    if "$ref" in schema:
        return validate_value(value, SCHEMAS[schema["$ref"].rsplit("/", 1)[1]], location)
    if value is None:
        assert schema.get("nullable"), f"{location}: null is not allowed"
        if "enum" in schema:
            assert None in schema["enum"], f"{location}: null enum mismatch"
        return
    if "oneOf" in schema:
        matches = 0
        for variant in schema["oneOf"]:
            try:
                validate_value(value, variant, location)
                matches += 1
            except (AssertionError, ValueError):
                pass
        assert matches == 1, f"{location}: oneOf matched {matches} variants"
        return
    expected = schema.get("type")
    checks = {"object": isinstance(value, dict), "array": isinstance(value, list),
              "string": isinstance(value, str), "integer": type(value) is int,
              "boolean": type(value) is bool, "number": type(value) in (int, float)}
    assert expected is None or checks[expected], f"{location}: expected {expected}, got {type(value).__name__}"
    if "enum" in schema:
        assert value in schema["enum"], f"{location}: enum mismatch {value!r}"
    if "not" in schema:
        assert value not in schema["not"].get("enum", []), f"{location}: excluded value"
    if expected == "object":
        assert set(schema.get("required", [])) <= value.keys(), f"{location}: missing required field"
        assert len(value) >= schema.get("minProperties", 0), f"{location}: too few fields"
        for key, item in value.items():
            prop = schema.get("properties", {}).get(key)
            if prop is not None:
                validate_value(item, prop, f"{location}.{key}")
            elif schema.get("additionalProperties") is False:
                raise AssertionError(f"{location}.{key}: unexpected field")
            elif isinstance(schema.get("additionalProperties"), dict):
                validate_value(item, schema["additionalProperties"], f"{location}.{key}")
    elif expected == "array":
        assert len(value) >= schema.get("minItems", 0), f"{location}: too few items"
        assert len(value) <= schema.get("maxItems", float("inf")), f"{location}: too many items"
        if schema.get("uniqueItems"):
            assert len({json.dumps(v, sort_keys=True) for v in value}) == len(value), f"{location}: duplicate items"
        for index, item in enumerate(value):
            validate_value(item, schema["items"], f"{location}[{index}]")
    elif expected == "string":
        assert len(value) >= schema.get("minLength", 0), f"{location}: string too short"
        assert len(value) <= schema.get("maxLength", float("inf")), f"{location}: string too long"
        if "pattern" in schema:
            assert re.search(schema["pattern"], value), f"{location}: pattern mismatch"
        if schema.get("format") == "date-time":
            datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
        elif schema.get("format") == "date":
            datetime.date.fromisoformat(value)
        elif schema.get("format") == "uuid":
            import uuid
            uuid.UUID(value)
        elif schema.get("format") == "uri":
            assert urlparse(value).scheme, f"{location}: URI requires scheme"
    elif expected in ("integer", "number"):
        assert value >= schema.get("minimum", float("-inf")), f"{location}: below minimum"
        assert value <= schema.get("maximum", float("inf")), f"{location}: above maximum"


def validate_contract(spec):
    import re
    operations = [operation for methods in spec["paths"].values() for operation in methods.values()]
    assert len(operations) == len(OPERATIONS), "Duplicate method/path pair"
    assert len({o["operationId"] for o in operations}) == len(operations), "Duplicate operationId"
    refs = []

    def walk(node):
        if isinstance(node, dict):
            if "$ref" in node:
                refs.append(node["$ref"])
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(spec)
    for pointer in refs:
        assert pointer.startswith("#/components/schemas/"), f"Unexpected ref {pointer}"
        assert pointer.rsplit("/", 1)[1] in SCHEMAS, f"Dangling ref {pointer}"
    for name, schema in SCHEMAS.items():
        assert set(schema.get("required", [])) <= schema.get("properties", {}).keys(), f"Invalid required: {name}"
        validate_value(sample(schema), schema, name)
        if "discriminator" in schema:
            for value, target in schema["discriminator"]["mapping"].items():
                variant = SCHEMAS[target.rsplit("/", 1)[1]]
                assert variant["properties"][schema["discriminator"]["propertyName"]]["enum"] == [value]
    for source in OPERATIONS:
        record = spec["paths"][source["path"]][source["method"]]
        names = {(p["in"], p["name"]) for p in record["parameters"]}
        assert len(names) == len(record["parameters"]), f"Duplicate parameters: {source['path']}"
        path_names = set(re.findall(r"\{([^}]+)\}", source["path"]))
        assert path_names == {p["name"] for p in record["parameters"] if p["in"] == "path"}
        assert all(p["required"] for p in record["parameters"] if p["in"] == "path")
        if source["path"].startswith("/admin/") and source["path"] != "/admin/auth/login":
            assert source["auth"] in ("admin", "admin_refresh"), f"Admin authentication missing: {source['path']}"
        if source["auth"] == "admin" and source["path"] not in ("/admin/me", "/admin/auth/logout"):
            assert source["permission"], f"Admin permission missing: {source['path']}"
        assert record["x-idempotency-required"] == (("header", "Idempotency-Key") in names)
        for param in record["parameters"]:
            if "example" in param["schema"]:
                validate_value(param["schema"]["example"], param["schema"], f"{record['operationId']}.{param['name']}")
        if "requestBody" in record:
            for content in record["requestBody"]["content"].values():
                if "example" in content:
                    validate_value(content["example"], content["schema"], record["operationId"] + ".request")
        for response in record["responses"].values():
            for content in response.get("content", {}).values():
                if "example" in content:
                    validate_value(content["example"], content["schema"], record["operationId"] + ".response")
    for name in ("UserSummary", "AdminUser", "AdminPrincipal", "OrderSummary", "AdminOrder"):
        assert not {"password", "passwordHash", "refreshToken", "secret"} & SCHEMAS[name]["properties"].keys()
    return {"operations": len(operations), "paths": len(spec["paths"]), "schemas": len(SCHEMAS), "resolvedRefs": len(refs)}


def validate_markdown_links():
    import re
    checked = 0
    for source in [ROOT / "README.md", *DOCS.glob("*.md")]:
        body = source.read_text(encoding="utf-8")
        for destination in re.findall(r"\]\(([^)]+)\)", body):
            if destination.startswith(("https://", "http://")):
                continue
            path, _, anchor = destination.partition("#")
            target = source.parent / path if path else source
            assert target.is_file(), f"Broken file link {source.name} -> {destination}"
            if anchor:
                target_text = target.read_text(encoding="utf-8")
                explicit = re.findall(r'<a id="([^"]+)"', target_text)
                headings = [re.sub(r"[^\w\-\u4e00-\u9fff ]", "", h.strip().lower()).replace(" ", "-")
                            for h in re.findall(r"^#+ (.+)$", target_text, flags=re.MULTILINE)]
                assert anchor in explicit + headings, f"Broken anchor {source.name} -> {destination}"
            checked += 1
    return checked


def validate_flow_examples():
    import re
    body = (DOCS / "03-business-flows.md").read_text(encoding="utf-8")
    checked = 0
    for block in re.findall(r"```http\n(.*?)```", body, re.DOTALL):
        request_line, rest = block.strip().split("\n", 1)
        method, path = request_line.split(" ", 1)
        candidates = [o for o in OPERATIONS if o["method"] == method.lower()
                      and re.fullmatch(re.sub(r"\{[^}]+\}", "[^/]+", o["path"]), path.removeprefix("/api/v1"))]
        assert len(candidates) == 1, f"Ambiguous example operation: {request_line}"
        operation = candidates[0]
        headers, _, payload = rest.partition("\n\n")
        if operation["body"]:
            validate_value(json.loads(payload), ref(operation["body"]), request_line)
        if operation["idem"]:
            assert "Idempotency-Key:" in headers, f"Missing idempotency example: {request_line}"
        if operation["auth"] in ("user", "admin"):
            assert "Authorization: Bearer " in headers, f"Missing auth example: {request_line}"
        checked += 1
    for block in re.findall(r"```json\n(.*?)```", body, re.DOTALL):
        value = json.loads(block)
        if "code" in value:
            schema = success_schema("SmsChallenge")
        elif "launchType" in value:
            schema = ref("PaymentAttempt")
        else:
            schema = ref("QuoteCreate")
        validate_value(value, schema, "flow JSON")
        checked += 1
    for event_name, payload in re.findall(r"event: (\w+)\ndata: (\{[^\n]+\})", body):
        schema_name = {"meta": "SseMetaEvent", "delta": "SseDeltaEvent", "done": "SseDoneEvent", "error": "SseErrorEvent"}[event_name]
        validate_value(json.loads(payload), ref(schema_name), "SSE " + event_name)
        checked += 1
    return checked


def implemented_spec(spec, auth_only=False):
    """Produce an importable contract containing only running endpoints and their schemas."""
    result = copy.deepcopy(spec)
    result['info']['title'] = '两性健康服务平台 · 已实现认证 API' if auth_only else '两性健康服务平台 · 已实现认证、交易与内容 API'
    result['paths'] = {
        path: {method: operation for method, operation in methods.items()
               if operation.get('x-implementation-status') == 'implemented'}
        for path, methods in result['paths'].items()
        if any(operation.get('x-implementation-status') == 'implemented' for operation in methods.values())
    }
    if auth_only:
        result['paths'] = {path: methods for path, methods in result['paths'].items()
                           if path in ('/health', '/me', '/me/password', '/me/sessions', '/me/sessions/{id}')
                           or path.startswith('/auth/') or path.startswith('/public/legal-documents/')}
    used_tags = {tag for methods in result['paths'].values() for operation in methods.values()
                 for tag in operation['tags']}
    result['tags'] = [tag for tag in result['tags'] if tag['name'] in used_tags]
    names = set()

    def visit(value):
        if isinstance(value, dict):
            reference = value.get('$ref', '')
            if reference.startswith('#/components/schemas/'):
                name = reference.rsplit('/', 1)[-1]
                if name not in names:
                    names.add(name)
                    visit(spec['components']['schemas'][name])
            for nested in value.values():
                visit(nested)
        elif isinstance(value, list):
            for nested in value:
                visit(nested)

    visit(result['paths'])
    result['components']['schemas'] = {name: schema for name, schema in result['components']['schemas'].items()
                                        if name in names}
    if auth_only:
        result['components']['securitySchemes'].pop('AdminBearer', None)
    return result


def main():
    OPERATIONS.sort(key=lambda operation: operation["tag"])
    finish_examples()
    spec = make_spec()
    report = validate_contract(spec)
    DOCS.mkdir(parents=True, exist_ok=True)
    (DOCS / "openapi.json").write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (DOCS / "openapi-auth.json").write_text(json.dumps(implemented_spec(spec, auth_only=True), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (DOCS / "openapi-implemented.json").write_text(json.dumps(implemented_spec(spec), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (DOCS / "01-api-reference.md").write_text(build_api_markdown() + "\n", encoding="utf-8")
    (DOCS / "02-data-models.md").write_text(build_data_markdown() + "\n", encoding="utf-8")
    # README is maintained with runnable backend instructions, independently of generated contracts.
    report["markdownLinks"] = validate_markdown_links()
    report["flowExamples"] = validate_flow_examples()
    print(json.dumps({"result": "PASS", **report}, ensure_ascii=False))


if __name__ == "__main__":
    main()





