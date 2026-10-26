"""Implemented membership purchase, profile and user-management contract."""
import copy


def apply_membership_users_contract(api):
    schemas, operations, implemented = (api[name] for name in ('SCHEMAS', 'OPERATIONS', 'IMPLEMENTED'))
    obj, string, integer, enum, array, ref, query = (api[name] for name in ('obj', 'string', 'integer', 'enum', 'array', 'ref', 'query'))
    version = {**api['VERSION'], 'maximum': 2147483647}
    benefits = array(enum('当前支持的网站会员内容权益。', 'MEMBER_CONTENT'),
                     '仅支持 MEMBER_CONTENT；AI 次数和会员组合权益尚未接入。', minItems=1, maxItems=1, uniqueItems=True)
    avatar = {**string('已上传到 CONTENT_IMAGE_OSS_HOST 的永久 HTTPS 对象地址，默认 chunai-photo.oss-cn-hangzhou.aliyuncs.com；不得带签名查询、fragment、账号或端口。null 清空头像，不传则保持。',
                       'https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/avatars/replace-with-existing-object.jpg',
                       format='uri', minLength=1, maxLength=2048), 'nullable': True}
    schemas['UserSummary']['properties'].update({'avatarUrl': avatar, 'version': version})
    schemas['UserSummary']['required'].append('version')
    obj('UserPatch', '修改本人昵称和头像，必须提供当前 version 及至少一个修改字段；不接受手机号、状态、会员期限或权限字段。', {
        'version': version,
        'nickname': string('前后空白会去除，禁止控制字符。', 'cs测试昵称', minLength=1, maxLength=32, pattern=r'^[^\u0000-\u001f\u007f]+$'),
        'avatarUrl': avatar}, ['version'], minProperties=2)
    obj('AdminUser', '管理端用户资料；手机号始终脱敏，不返回密码、会话令牌或问答内容。封禁时间永久保留到解封，当前不支持定时封禁。', {
        **copy.deepcopy(schemas['UserSummary']['properties']),
        'banReason': {**string('当前封禁原因；未封禁时为 null。', maxLength=500), 'nullable': True, 'example': None},
        'bannedAt': api['NULL_TIME'], 'lastLoginAt': api['NULL_TIME'], 'updatedAt': api['TIME']})
    for name, description in [('UserBanInput', '封禁 ACTIVE 用户并立即撤销全部客户端会话。'),
                              ('UserUnbanInput', '解封 BANNED 用户；旧令牌保持失效，必须重新登录。')]:
        obj(name, description + '必须携带最新版本和幂等键。DEACTIVATED 不允许此操作。', {
            'version': version, 'reason': string('操作原因；去除前后空白，写入审计。', 'cs权限联调', minLength=1, maxLength=500)})

    plan_fields = {
        'name': string('会员方案名称；去除前后空白。', 'cs30天会员', minLength=1, maxLength=64),
        'description': string('方案说明，允许空字符串。', 'cs会员内容访问测试方案', maxLength=2000),
        'durationDays': integer('每一天为固定 24 小时。', 30, 1, maximum=3650),
        'priceCents': integer('人民币分；客户端不能自行决定成交金额。', 9900, 1, maximum=100000000),
        'benefitCodes': benefits,
        'sortOrder': integer('公开展示顺序，小值优先。', 0, 0, maximum=1000000),
    }
    result_fields = {'id': api['ID'], **copy.deepcopy(plan_fields), 'enabled': api['boolean']('是否可购买；停用后公共接口不可见。', False),
                     'version': version, 'createdAt': api['TIME'], 'updatedAt': api['TIME']}
    obj('MembershipPlan', '会员方案；公开接口只返回启用项。无自动续费，当前只授予 MEMBER_CONTENT。', result_fields)
    obj('AdminMembershipPlan', '管理员会员方案；包括启用与停用记录。历史订单使用成交快照，停用保留历史引用。', result_fields)
    obj('MembershipPlanCreate', '新建方案默认停用；需要另外 PATCH enabled=true 才可购买，不接受 enabled、currency 或 AI 次数字段。',
        plan_fields, ['name', 'description', 'durationDays', 'priceCents'])
    obj('MembershipPlanPatch', '必须提交 version 和至少一项修改；历史订单的价格、天数、权益快照保持不变。无删除接口，使用停用。', {
        'version': version, **copy.deepcopy(plan_fields), 'enabled': api['boolean']('是否允许新报价、下单及待付款订单结算。', True)}, ['version'], minProperties=2)
    obj('MembershipPlanSnapshot', '报价、成交订单和权益段使用的方案快照；修改方案不改写已成交条款。', {
        'planId': api['ID'], **{key: copy.deepcopy(plan_fields[key]) for key in ('name', 'durationDays', 'priceCents', 'benefitCodes')}})
    obj('MembershipPeriod', '一笔会员订单对应的完整权益段；ACTIVE 不等于当前生效，仍须判断时间和账号状态。', {
        'id': api['ID'], 'userId': api['ID'], 'planId': api['ID'], 'orderId': api['ID'], 'snapshot': ref('MembershipPlanSnapshot'),
        'startsAt': api['TIME'], 'expiresAt': api['TIME'],
        'status': enum('ACTIVE 可按时间生效；REFUND_PENDING 为退款目标；SUSPENDED 为等待退款结果的其他未来段；REVOKED 已退款。',
                       'ACTIVE|REFUND_PENDING|SUSPENDED|REVOKED'),
        'revokedAt': api['NULL_TIME'], 'createdAt': api['TIME']})
    for name in ('MembershipSummary', 'MembershipDetail'):
        schemas[name]['properties']['expiresAt']['description'] = '未撤销的管理员期限和 ACTIVE 付费段的最晚到期时间，包括未来或已过期时段；无候选记录时为 null。请用 active 判断当前资格。'
    schemas['MembershipDetail']['description'] = '服务器聚合管理员期限及购买权益段判断当前会员；会员明细分页通过 /me/membership/periods 查询。'
    schemas['MembershipDetail']['properties']['membership']['description'] = '管理员手工维护的期限记录，独立于购买权益；没有手工记录时为 null，即使有有效购买权益也可为 null。'
    for name in ('MembershipWrite', 'MembershipRevoke'):
        schemas[name]['description'] += ' 存在未到期付费段或待处理退款时返回 MEMBERSHIP_PAID_TERM_EXISTS；付费权益通过订单退款维护。'
    api['union']('ImplementedPurchase', '商品、课程、会员方案三选一；禁止混单和客户端传金额。',
                 ['ProductPurchase', 'CoursePurchase', 'MembershipPurchase'], 'type')
    schemas['OrderItem']['properties']['membershipSnapshot'] = {**copy.deepcopy(schemas['MembershipPlanSnapshot']), 'nullable': True,
        'description': '会员订单为成交方案快照；其他类型为 null 或省略。'}
    for name in ('OrderQuote', 'OrderDetail', 'AdminOrder'):
        schemas[name]['properties']['address']['description'] = '实物订单地址快照；课程和会员订单为 null。'
    schemas['OrderDetail']['description'] = '本人订单详情；COURSE 和 MEMBERSHIP 不预占库存，不进入发货、收货或实物售后，address=null，运费为 0。'
    schemas['TestRefundInput']['description'] = '测试退款确认：COURSE 和 MEMBERSHIP 的 version 取退款流水；PRODUCT 取售后单。会员退款成功撤销目标未来段并顺延整理其余段，失败恢复。'
    schemas['DigitalRefundInput']['description'] = '管理员发起数字订单全额退款；课程遵循原规则，会员仅允许尚未开始的完整未来权益段。请求不接受金额。'

    api['paged']('07 会员与已购课程', '/me/membership/periods', '本人会员购买权益段', 'MembershipPeriod',
                 note='仅本人，按 createdAt 降序、id 升序；保留未来、过期和已退款历史。资格以 GET /me/membership 的 active 为准。')
    api['paged']('17 用户与会员管理', '/admin/users/{id}/membership/periods', '用户会员购买权益段', 'MembershipPeriod',
                 auth='admin', permission='membership:write', note='分页读取指定用户权益段，按 createdAt 降序、id 升序，读取审计；无用户返回 404。')
    for operation in operations:
        method, path = operation['method'], operation['path']
        if path.startswith('/membership-plans') or path.startswith('/admin/membership-plans') or path in (
                '/admin/users', '/admin/users/{id}', '/admin/users/{id}/ban', '/admin/users/{id}/unban',
                '/me/membership/periods', '/admin/users/{id}/membership/periods') or (method, path) == ('patch', '/me'):
            implemented.add((method, path))
        if path == '/admin/users':
            operation['params'] = [*api['PAGINATION'],
                query('keyword', string('昵称字面子串；% 和 _ 不作为通配符。', 'cs', minLength=1, maxLength=64)),
                query('phone', api['PHONE']), query('status', enum('账号状态。', 'ACTIVE|BANNED|DEACTIVATED')),
                query('hasMembership', api['boolean']('按当前时间及账号状态过滤有效会员。', True)), *api['DATE_FILTER']]
            operation['note'] = '按 createdAt,id 降序；手机号精确匹配，响应仍脱敏；搜索值不写入审计。createdFrom/createdTo 均包含边界，from<=to。仅允许列出的筛选字段。'
        if path == '/admin/users/{id}':
            operation['note'] = '返回脱敏用户资料和即时会员摘要，读取记录审计。'
        if path in ('/admin/users/{id}/ban', '/admin/users/{id}/unban'):
            operation['note'] = '须 users:ban、最新 version 和 Idempotency-Key；封禁立即撤销全部客户端会话，解封后重新登录。保留订单及会员期限，封禁期间管理员仍可退款；会员计时不暂停。不支持 until。'
        if (method, path) == ('patch', '/me'):
            operation['note'] = '先 GET /me 读取 version，再修改 nickname 或 avatarUrl；头像只登记现有 OSS HTTPS 对象地址，null 清空。至少一个修改字段；版本冲突返回 409。'
        if path in ('/membership-plans', '/admin/membership-plans') and method == 'get':
            operation['params'] = [*api['PAGINATION'], query('keyword', string('方案名称子串。', 'cs', minLength=1, maxLength=64))]
            if path.startswith('/admin/'):
                operation['params'].append(query('enabled', api['boolean']('启用状态。', True)))
            operation['note'] = '按 sortOrder 升序、createdAt 降序、id 升序；公共接口只显示启用方案。'
        if path == '/membership-plans/{id}':
            operation['note'] = '仅启用方案可见；未启用或不存在返回 404。'
        if path == '/order-quotes':
            operation.update(title='商品／课程／会员下单试算', body='ImplementedPurchase',
                             note='PRODUCT、COURSE、MEMBERSHIP 三选一。会员只传 type 和 planId；单份数量 1，无地址和运费。报价有效 10 分钟，方案停用或价格、天数、权益改变后须重新报价。')
        if path == '/orders' and method == 'post':
            operation['note'] = '报价归属本人且最多创建一单；重校验可售和成交条款，待付款 30 分钟。会员允许续购；同用户同方案最多一份有效待付款会员订单。付款按订单快照追加完整会员段。'
        if path == '/admin/orders/{id}/test-payment':
            operation['note'] = '仅测试环境且显式开启测试支付。会员付款、订单 COMPLETED 和权益段追加在同一事务完成；从 max(now,未撤销手工期限,现有付费段结束) 开始，不提前生效未来方案。方案修改不改已下单条款，停用阻止结算。'
        if path == '/admin/orders/{id}/digital-refund':
            operation['note'] = 'COURSE 或 MEMBERSHIP 全额退款。会员只允许未来尚未开始的完整段：目标转 REFUND_PENDING，其他未来付费段转 SUSPENDED；已开始段继续。处理中阻止会员结算与手工改期。成功撤销目标并按完整时长整理后续段；失败恢复。已开始或已过期段返回 MEMBERSHIP_REFUND_NOT_ALLOWED。'
        if path == '/admin/refunds/{id}/test-result':
            operation['note'] = '仅 TEST 支付；数字订单 version 为退款流水版本，产品售后为售后单版本。会员成功撤销目标段并整理其余未来段；失败恢复，重试须目标仍未开始。'
        if path in ('/me/membership', '/admin/users/{id}/membership') and method == 'get':
            operation['note'] = '有效账号且管理员期限或 ACTIVE 购买权益段覆盖当前时间才 active=true；只覆盖 MEMBER 内容。membership 字段专指手工期限，购买明细见 /membership/periods。'
        if path == '/admin/users/{id}/membership' and method == 'put':
            operation['note'] += ' 存在未到期 ACTIVE 付费段或退款中段时返回 MEMBERSHIP_PAID_TERM_EXISTS，防止覆盖已付费时长。'
        if path == '/admin/users/{id}/membership/revoke':
            operation['note'] = '只撤销手工期限，存在未到期付费段或退款中段则返回 MEMBERSHIP_PAID_TERM_EXISTS；付费段通过订单退款维护。会员内容访问每次重查资格。'
