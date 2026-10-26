"""User-owned carts, checkout snapshots and content favorites."""
import copy


def apply_cart_favorites_contract(api):
    schemas = api['SCHEMAS']
    obj, string, integer, enum, ref, array = (api[n] for n in ('obj', 'string', 'integer', 'enum', 'ref', 'array'))
    uuid = string('UUID v4。', 'fedb46b4-eae6-44a8-8abd-1739bb089611', format='uuid')
    obj('CartProduct', '当前公开商品信息；下架或分类停用后为 null。不保存旧价格快照。', {
        'name': string('商品名称。', 'cs商品'), 'coverUrl': {**api['URI'], 'nullable': True},
        'skuAttributes': array('SkuAttribute', '当前规格。'), 'unitPriceCents': api['MONEY'],
        'subtotalCents': integer('当前单价 × 保存数量，仅供展示，不是订单报价。', 2400), 'currency': enum('币种。', 'CNY')}, nullable=True)
    schemas['CartProduct']['example'] = {'name': 'cs商品', 'coverUrl': 'https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/cs.png',
        'skuAttributes': [{'name': '规格', 'value': '标准'}], 'unitPriceCents': 1200, 'subtotalCents': 2400, 'currency': 'CNY'}
    obj('CartItem', '本人购物车的一种 SKU；数量不占库存；可购买状态在每次读取时重新计算。', {
        'id': uuid, 'skuId': uuid, 'productId': uuid, 'quantity': integer('保存的期望数量，库存减少时不自动改写。', 2, 1, maximum=999),
        'selected': api['boolean']('是否勾选；失效后保留选择意图，仍不可结算。', True),
        'version': api['VERSION'], 'createdAt': api['TIME'], 'updatedAt': api['TIME'],
        'availability': enum('按商品、分类、SKU、可售库存、保存数量依次判定。', 'AVAILABLE|PRODUCT_UNAVAILABLE|CATEGORY_UNAVAILABLE|SKU_DISABLED|OUT_OF_STOCK|STOCK_INSUFFICIENT'),
        'canPurchase': api['boolean']('仅 availability=AVAILABLE 为 true；不取决于 selected。', True),
        'availableStock': integer('实物库存减去订单预占；购物车本身不预占。', 5),
        'maxQuantity': integer('min(999, availableStock)；仍需同时判断 canPurchase／availability。', 5, 0, maximum=999),
        'product': ref('CartProduct')})
    obj('CartItemPut', '按 SKU 设置绝对数量，不累加。首次 version=0；已有条目使用最新 version。', {
        'quantity': integer('整数 1–999；不能用 0 删除。', 2, 1, maximum=999),
        'version': integer('首次为 0；旧版本返回 VERSION_CONFLICT。', 0, 0, maximum=2147483647),
        'selected': api['boolean']('可省略：新建默认 true；更新保留原值。', True)}, ['quantity', 'version'])
    obj('CartQuoteLine', '本次明确选择的购物车 SKU 与当前购物车条目版本。数量从数据库取。', {'skuId': uuid, 'version': api['VERSION']})
    obj('CartQuoteCreate', '购物车结算试算；不接受客户端金额、数量或用户 ID。', {
        'addressId': uuid, 'items': array('CartQuoteLine', '1–50 个不重复的本人已勾选 SKU；任一不可购买则整个试算失败。', minItems=1, maxItems=50, uniqueItems=True)})
    schemas['FavoriteContent'] = {**copy.deepcopy(schemas['ContentSummary']), 'nullable': True,
        'description': '有效收藏返回当前公开摘要；下架或分类停用为 null，不返回旧标题、封面、正文或视频链接。'}
    obj('ContentFavorite', '收藏关系不等于访问权益。失效项保留供取消或重新上架后恢复。', {
        'id': uuid, 'contentId': uuid, 'createdAt': api['TIME'], 'valid': api['boolean']('当前内容是否上架且所属分类启用。', False),
        'invalidReason': {'type': 'string', 'nullable': True, 'enum': [None, 'CONTENT_UNAVAILABLE', 'CATEGORY_UNAVAILABLE'],
                          'description': '有效时 null；下架优先于分类停用。', 'example': 'CONTENT_UNAVAILABLE'},
        'content': ref('FavoriteContent'), 'access': ref('AccessDecision')})
    schemas['NullableContentFavorite'] = {**copy.deepcopy(schemas['ContentFavorite']), 'nullable': True,
        'description': '未收藏时为 null；收藏后包含当前有效性与访问判定。'}
    schemas['ContentFavorite']['example'] = {'id': uuid['example'], 'contentId': uuid['example'], 'createdAt': '2026-10-27T00:00:00Z',
        'valid': False, 'invalidReason': 'CONTENT_UNAVAILABLE', 'content': None, 'access': {'canAccess': False, 'reason': 'CONTENT_UNAVAILABLE'}}
    obj('FavoriteState', '查询本人是否已收藏，包含失效收藏；未知 UUID 返回未收藏，不暴露其他用户记录。', {
        'contentId': uuid, 'favorited': api['boolean']('本人是否保存此收藏关系。'), 'favorite': ref('NullableContentFavorite')})
    start = len(api['OPERATIONS'])
    tag = '18 购物车与内容收藏'
    api['paged'](tag, '/me/cart', '查询本人购物车', 'CartItem', note='最多保存 200 种 SKU。按加入时间、ID 倒序，分页默认 20、最多 100。失效商品保留，购买资格和金额每次重算；前端仅展示，不据此跳过试算。')
    api['op'](tag, 'put', '/me/cart/items/{skuId}', '加入购物车／设置数量和勾选', body='CartItemPut', data='CartItem',
              note='只能操作本人购物车。数量为绝对值；首次 version=0，已有条目须传最新版本。新增、增加数量或从未选变已选时必须可购买；已失效条目允许减量、取消勾选或保持原值。相同版本相同值不增加版本，陈旧版本返回 409 后须刷新，不能盲目累加。无需 Idempotency-Key。')
    api['op'](tag, 'delete', '/me/cart/items/{skuId}', '移除本人购物车条目', params=[api['query']('version', api['VERSION'], True)],
              note='仅删除本人的该 SKU；须携带当前条目版本；已不存在时重复删除成功。下架或库存不足不妨碍删除。')
    api['op'](tag, 'post', '/me/cart/quote', '购物车结算试算', body='CartQuoteCreate', data='OrderQuote', status=201,
              note='明确提交本次勾选的 SKU 和购物车条目 version，地址须本人所有。任一版本、选择状态、商品状态或数量不符均整体失败。按当前价格生成十分钟报价，不占库存。随后 POST /orders + Idempotency-Key；下单时重查状态、价格、规格和库存并预占。订单成功后同事务移除与试算时 id/version/quantity 仍一致的条目；已改动、重新加入、未参与结算的条目保留，失败不清理。取消订单释放库存但不自动恢复购物车。普通 /order-quotes 下单不清理购物车。')
    api['paged'](tag, '/me/favorites', '查询本人收藏', 'ContentFavorite', params=[
        api['query']('kind', enum('内容类型；收藏整门课程，不收藏章节或专栏。', 'SCIENCE_ARTICLE|SCIENCE_VIDEO|ARTICLE_COURSE|VIDEO_COURSE')),
        api['query']('status', enum('可选过滤有效／失效收藏；与是否已购买或为会员无关。', 'VALID|INVALID'))],
        note='默认包含有效和失效收藏，按收藏时间、ID 倒序。内容下架／分类停用时 valid=false、content=null；重新上架恢复。正文和播放仍走原鉴权接口。已购下架课程保留原购买权益，可从 /me/courses 访问，不因收藏失效撤销。')
    api['op'](tag, 'get', '/me/favorites/{contentId}', '查询本人收藏状态', data='FavoriteState', note='favorite=null 表示未收藏，包含不存在的内容 UUID；不能指定其他用户 ID。')
    api['op'](tag, 'put', '/me/favorites/{contentId}', '收藏图文／视频／整门课程', data='ContentFavorite',
              note='无请求体或 {}。只新增已上架且分类启用的内容；免费、付费、会员内容均可收藏，不要求已购买。重复请求幂等，保留首次收藏时间；已收藏但已下架时返回原关系的失效状态，不泄露内容。每用户最多 1000 条。')
    api['op'](tag, 'delete', '/me/favorites/{contentId}', '取消本人收藏', note='有效和失效收藏均可取消；重复取消成功，只操作本人记录。')
    api['IMPLEMENTED'].update((o['method'], o['path']) for o in api['OPERATIONS'][start:])
