"""Low-cost short-polling inbox and transactional business notifications."""


def apply_messages_contract(api):
    schemas = api['SCHEMAS']
    # Supersede the original, never implemented task/broadcast notification design.
    api['OPERATIONS'][:] = [o for o in api['OPERATIONS']
                            if not o['path'].startswith(('/me/notifications', '/admin/notification-tasks'))]
    for name in ('NotificationTarget', 'Notification', 'UnreadCount', 'ReadAllInput',
                 'NotificationTaskInput', 'NotificationTask', 'NotificationUsersInput',
                 'NotificationAllInput', 'PageNotification', 'PageNotificationTask'):
        schemas.pop(name, None)
    for operation in api['OPERATIONS']:
        if operation['path'] == '/admin/audit-logs':
            operation['tag'] = '18 管理审计'

    obj, string, integer, enum, array = (api[n] for n in ('obj', 'string', 'integer', 'enum', 'array'))
    uuid = string('UUID v4。', 'fedb46b4-eae6-44a8-8abd-1739bb089611', format='uuid')
    sequence = string('非负十进制整数字符串，最多 19 位；除 0 外无前导零。必须作为字符串保存，不转 JavaScript Number。',
                      '12', pattern=r'^(0|[1-9]\d{0,18})$', maxLength=19)
    state = {
        'revision': {**sequence, 'description': '本人收件箱版本；新增、已读、删除实际改变状态时递增，不能用作消息序号。'},
        'unreadCount': integer('未删除消息的未读数量，由写事务维护；轮询不执行 COUNT。', 2),
        'latestSequence': {**sequence, 'description': '本人历来分配的最大消息序号；删除不回退，空收件箱为字符串 0。'},
    }
    obj('InAppMessage', '本人站内消息。正文纯文本，使用 textContent 或框架默认转义渲染；资源跳转仍需对应业务接口鉴权。', {
        'id': uuid, 'sequence': {**sequence, 'description': '本人收件箱内单调递增的序号，实际消息大于 0；不同用户序号独立。'},
        'category': enum('消息分类；发货与运单更正归 ORDER。', 'ORDER|AFTERSALE|MEMBERSHIP|SYSTEM'),
        'title': string('纯文本标题。', '订单已发货', minLength=1, maxLength=120),
        'body': string('纯文本正文，不作为 HTML 执行。', '您的订单已发货，请进入订单查看物流。', minLength=1, maxLength=2000),
        'resourceType': {'type': 'string', 'enum': ['ORDER', 'AFTERSALE', 'MEMBERSHIP', None], 'nullable': True,
                         'description': '关联资源类别；管理员手动消息为 null；前端使用固定路由。', 'example': 'ORDER'},
        'resourceId': {**uuid, 'nullable': True, 'description': '关联订单或售后 ID；MEMBERSHIP 为本人用户 ID，前端读取 /me/membership；无关联时为 null。'},
        'readAt': api['NULL_TIME'], 'createdAt': api['TIME'],
    })
    obj('MessagePollResult', '短轮询立即返回当前状态，不保持连接。无消息且 revision=0 时 changed=false。', {
        'changed': api['boolean']('收件箱当前 revision 是否与请求不同；已读和删除也可能触发。', True),
        **state, 'pollAfterSeconds': integer('建议至少等待的轮询间隔，固定 60 秒，可再增加 0–10 秒随机抖动。', 60, 60, maximum=60),
    })
    obj('MessagePage', '游标分页，无 total 和 COUNT。afterSequence 升序读取新消息，其余按序号倒序读取历史。', {
        'items': array('InAppMessage', '当前页，空列表为 []；不含已删除消息。'),
        'hasMore': api['boolean']('当前方向是否还有消息；使用 limit+1 判定。'),
        'nextBeforeSequence': {**sequence, 'nullable': True, 'description': '历史模式且 hasMore=true 时为本页最后序号；其他情况 null。'},
        'nextAfterSequence': {**sequence, 'nullable': True, 'description': '增量模式为本页最后序号；空页保留请求 afterSequence，即使 hasMore=false 也返回。历史模式为 null。'},
    })
    obj('MessageMutationResult', '已读／删除操作后的收件箱状态；无实际变化时 revision 不增加。', {
        'updated': integer('实际修改的消息数；重复已读为 0，成功删除为 1。', 1), **state,
    })
    obj('MessagesReadInput', '批量标记本人消息已读；任一 ID 不存在、已删除或属于他人，整个操作 404 并回滚。', {
        'ids': array(uuid, '1–100 个不重复的本人消息 UUID v4。', minItems=1, maxItems=100, uniqueItems=True),
    })
    obj('MessagesReadAllInput', '标记已知快照范围内全部已读；不得使用未来上界，防止把并发到达的新消息标记已读。', {
        'throughSequence': {**sequence, 'description': '此前轮询返回的 latestSequence；只更新 <= 此值的本人未读消息，大于服务器当前最大序号返回 400。'},
    })
    obj('AdminMessageInput', '向明确指定的活跃用户同步发送 SYSTEM 纯文本消息；不接受任意链接、资源目标或用户群发选择器。', {
        'userIds': array(uuid, '1–100 个不重复的 ACTIVE 用户 UUID v4；任一接收者不可用则整体 404，不会部分发送。', minItems=1, maxItems=100, uniqueItems=True),
        'title': string('纯文本标题，不能全为空白。', 'cs服务通知', minLength=1, maxLength=120, pattern=r'\S'),
        'body': string('纯文本正文，不能全为空白；前端必须转义显示。', '您可以在消息中心查看订单、售后和会员通知。', minLength=1, maxLength=2000, pattern=r'\S'),
    })
    obj('AdminMessageResult', '已在同一事务内全部投递；相同幂等键及请求重放返回原结果。', {
        'sentCount': integer('本次接收人数。', 1, 1, maximum=100),
        'messageIds': array(uuid, '生成的消息 ID；不承诺与输入 userIds 的顺序对应。', minItems=1, maxItems=100, uniqueItems=True),
    })
    start = len(api['OPERATIONS'])
    tag = '10 站内消息'
    api['op'](tag, 'get', '/me/messages/poll', '短轮询本人消息变化与未读数', data='MessagePollResult',
              params=[api['query']('revision', {**sequence, 'default': '0'})],
              note='普通用户令牌。建议前台每 60–70 秒请求一次，隐藏页面暂停、失败退避，禁止重叠请求。每次只读取本人消息状态一行；加上认证读取，不更新会话活跃时间，不扫描消息、不 COUNT、不写心跳。changed=true 再按需读取列表；revision 不同不一定有新增消息，可能是已读或删除。响应 private,no-store。')
    api['op'](tag, 'get', '/me/messages', '本人消息游标列表', data='MessagePage', params=[
        api['query']('afterSequence', {**sequence, 'description': '仅返回大于此序号的新消息，按升序；与 beforeSequence 互斥。'}),
        api['query']('beforeSequence', {**sequence, 'description': '仅返回小于此序号的历史消息，按降序；不传两个游标则返回最新页。'}),
        api['query']('limit', integer('每页条数，默认 20，最多 50。', 20, 1, maximum=50, default=20)),
        api['query']('unreadOnly', api['boolean']('可选：true 只返回未读；false 或省略返回全部未删除消息。')),
    ], note='仅查询本人，读取列表不会标记已读。游标是序号字符串，不能传两个方向、page/pageSize、userId 或 category。增量分页只补新增消息，不传播旧消息已读或删除；跨端发生状态变动时应重新加载当前列表。')
    api['op'](tag, 'get', '/me/messages/{id}', '本人消息详情', data='InAppMessage', note='UUID v4。详情不自动已读；他人、已删除或不存在的消息统一 404。资源引用只是导航提示，不赋予订单、售后或会员权限。')
    api['op'](tag, 'post', '/me/messages/read', '批量标记本人消息已读', body='MessagesReadInput', data='MessageMutationResult',
              note='1–100 个不同 UUID v4，全部成功或全部回滚。重复标记已经已读的消息不再减少未读数、不增加 revision。无需 Idempotency-Key。')
    api['op'](tag, 'post', '/me/messages/read-all', '将已知快照范围全部标记已读', body='MessagesReadAllInput', data='MessageMutationResult',
              note='通过 throughSequence 明确已读上界；新到达的更大序号仍未读。大于当前最大序号返回 400；重复操作 updated=0。无需 Idempotency-Key。')
    api['op'](tag, 'delete', '/me/messages/{id}', '删除本人站内消息', data='MessageMutationResult',
              note='软删除后不再出现在列表或详情；删除未读消息同步减未读数。事件去重键保留，业务重放不会重新投递。重复删除、跨用户或不存在均 404；无需 Idempotency-Key。')
    api['op'](tag, 'post', '/admin/messages', '向指定用户发送站内消息', auth='admin', permission='messages:write',
              body='AdminMessageInput', data='AdminMessageResult', status=201, idem=True,
              note='仅具有 messages:write 的管理员；一次最多 100 个明确的 ACTIVE 用户，事务内同步投递并审计。category 固定 SYSTEM，resourceType/resourceId=null。重试必须复用幂等键和原请求；不同内容同键 409。不提供全站广播任务、用户私信或管理员读取私人收件箱接口。')
    api['IMPLEMENTED'].update((o['method'], o['path']) for o in api['OPERATIONS'][start:])
