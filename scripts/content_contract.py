"""Implemented content/course additions to the shared API contract."""
import copy


def apply_content_contract(api):
    s, operations, implemented = api['SCHEMAS'], api['OPERATIONS'], api['IMPLEMENTED']
    enum, string, query, ref = (api[n] for n in ('enum', 'string', 'query', 'ref'))
    op, obj = api['op'], api['obj']
    for o in operations:
        path = o['path']
        if (o['tag'] in ('03 视频、图文与专栏', '13 分类与内容管理', '14 专栏管理')
                or path in ('/me/courses', '/admin/orders/{id}/digital-refund')):
            implemented.add((o['method'], path))
        if path == '/order-quotes':
            o.update(body='ImplementedPurchase', title='商品／课程下单试算', note='PRODUCT 或 COURSE 二选一，不混单。报价 10 分钟有效；课程不含地址和运费。价格变动后下单返回 QUOTE_CHANGED。')
        if path == '/orders' and o['method'] == 'post':
            o['note'] = '报价最多一单；重新校验可售状态与价格。产品预占库存，课程阻止同用户重复待付款单及重复已购。30 分钟付款超时可取消。课程支付成功原子授予永久访问权并完成订单。'
        if path in ('/categories', '/admin/categories'):
            for p in o['params']:
                if p['name'] == 'scope': p['schema'] = enum('分类作用域；公共列表省略时默认 PRODUCT。', 'PRODUCT|SCIENCE|COURSE')
            o['note'] = '支持 PRODUCT（商品）、SCIENCE（科普）、COURSE（课程）；旧 CONTENT 返回 400，父子分类必须同域。被子分类、产品或内容引用时不可删除。'
        if path in ('/articles', '/videos'):
            o['params'].append(query('tag', string('精确匹配公开标签。', 'cs', minLength=1, maxLength=20)))
        if path in ('/me/membership', '/admin/users/{id}/membership'):
            implemented.add((o['method'], path))
            o['note'] = '以服务端时间判断 startsAt <= now < expiresAt，且未撤销、账号有效。会员由管理员开通／续期／撤销；当前不提供会员方案购买。'
            if path.startswith('/admin/'):
                o['permission'] = 'membership:write'
        if path == '/videos/{id}/playback':
            o['note'] = '仅 SCIENCE_VIDEO。按 mode 分支：STREAM 返回本地短时 playbackUrl；EXTERNAL_LINK 返回 BILIBILI externalUrl，不能当作视频文件 URL 播放。响应禁止缓存。'
        if path == '/chapters/{id}/playback':
            o['note'] = '仅 VIDEO 章节。LOCAL 保留短时流播放；FEISHU 仅用于 MEMBER 视频课程非预览章节，重新校验有效网站会员后返回链接和密码。无会员返回 403，不泄漏外链。管理员使用专属预览接口。响应禁止缓存。'
        if path == '/admin/orders/{id}/digital-refund':
            o['note'] = '当前只支持 COURSE 全额退款；orderVersion 为订单版本。创建 PROCESSING 退款不会撤销访问权；测试退款成功才原子撤权并关闭订单。FAILED 可用同接口和最新订单版本重试，重用退款 ID。'
        if path == '/admin/refunds/{id}/test-result':
            o['note'] = '仅 TEST 支付；课程退款 version 为退款流水版本，产品售后仍为售后单版本。成功才改金额并撤销本订单课程权益，失败保留权益。'
        if path in ('/admin/contents/{id}/body', '/admin/chapters/{id}/body'):
            o['note'] = '图文传 bodyHtml + imageMediaIds，视频只传 videoMediaId，不能混用。BILIBILI 仅可绑定 SCIENCE_VIDEO；FEISHU 仅可绑定 MEMBER 视频课程且 isPreview=false；LOCAL 保留。正文图片必须是 CONTENT_BODY_IMAGE 素材。'
        if path == '/admin/chapters/{id}/unpublish':
            o['note'] = '下架最后一章时自动下架课程，并增加课程版本。已购用户可继续读取历史已发布章节；草稿始终不可见。'
        if path == '/admin/contents/{id}' and o['method'] == 'delete':
            o['note'] = '只物理删除从未发布、没有章节、专栏、报价或订单引用的草稿；已发布内容保留历史，使用下架。'
        if path == '/admin/columns/{id}' and o['method'] == 'delete':
            o['note'] = '先下架专栏再删除；同时移除分组关联，内容、课程和购买权益保留。'
    api['union']('ImplementedPurchase', '当前可用的商品或课程试算，不包含会员购买。', ['ProductPurchase', 'CoursePurchase'], 'type')
    s['CategoryCreate']['properties']['scope'] = enum('作用域。', 'PRODUCT|SCIENCE|COURSE')
    s['ContentCreate']['properties']['categoryId']['description'] = '科普必须选择 SCIENCE 分类，课程必须选择 COURSE 分类；分类须启用。'
    s['ContentPatch']['properties']['categoryId']['description'] = '必须与内容 kind 匹配：科普用 SCIENCE，课程用 COURSE。'
    for name in ('ContentCreate', 'ContentPatch', 'ContentSummary', 'ContentDetail', 'AdminContent'):
        s[name]['properties']['accessPolicy'] = enum('FREE 免费、PURCHASE 独立购买、MEMBER 按网站会员有效期；MEMBER 仅课程且 priceCents=0。', 'FREE|PURCHASE|MEMBER')
    s['ContentPatch']['description'] += ' 已有购买订单历史的课程不能改为 MEMBER，返回 RESOURCE_IN_USE，保留原有购买权益。'
    s['AccessDecision']['properties']['reason'] = enum('授权或阻断原因；MEMBERSHIP_REQUIRED 表示需要有效网站会员。', 'FREE|PURCHASED|MEMBER|PREVIEW|ADMIN|LOGIN_REQUIRED|PURCHASE_REQUIRED|MEMBERSHIP_REQUIRED|CONTENT_UNAVAILABLE')
    s['MediaSummary']['properties']['provider'] = enum('内容素材来源；产品素材可省略。不会暴露外部视频链接或密码。', 'LOCAL|OSS|EXTERNAL_IMAGE|BILIBILI|FEISHU', 'OSS')
    s['MembershipSummary']['properties']['benefitCodes'] = api['array'](enum('当前会员内容权益。', 'MEMBER_CONTENT'), '有效时为 [MEMBER_CONTENT]，无效时为 []')
    obj('MembershipRecord', '管理员维护的一名用户的会员期限；修改须校验 version。', {
        'id': api['ID'], 'userId': api['ID'], 'startsAt': api['TIME'], 'expiresAt': api['TIME'],
        'revokedAt': api['NULL_TIME'], 'version': api['VERSION']})
    obj('MembershipDetail', '当前网站会员状态和期限记录；会员资格每次按服务器时间、撤销状态与账号状态判断。', {
        **copy.deepcopy(s['MembershipSummary']['properties']),
        'membership': {**copy.deepcopy(s['MembershipRecord']), 'nullable': True, 'description': '没有会员记录时为 null。'}})
    for name in ('MembershipSummary', 'MembershipDetail'):
        s[name]['properties']['expiresAt']['description'] = '有记录时返回存储的到期时间，包括未来、已过期或已撤销记录；无记录时为 null。有效性以 active 为准。'
    obj('MembershipWrite', '开通、续期或重新开通会员；从 GET 读取 version，无记录用 0。expiresAt 必须晚于 startsAt 且晚于当前时间。', {
        'version': api['integer']('创建用 0，已有记录用当前版本。', 0, 0, maximum=4294967294),
        'startsAt': api['TIME'], 'expiresAt': {**api['TIME'], 'example': '2026-11-21T02:00:00Z'},
        'reason': string('管理员操作原因，写入审计。', 'cs开通30天测试会员', minLength=1, maxLength=500)})
    obj('MembershipRevoke', '撤销会员；立即停止签发受会员保护的访问数据。', {
        'version': {**api['VERSION'], 'maximum': 4294967294}, 'reason': string('撤销原因。', 'cs撤销测试会员', minLength=1, maxLength=500)})
    for field in ('startsAt', 'expiresAt'):
        s['MembershipWrite']['properties'][field]['description'] = 'ISO 8601 时间，必须包含秒和明确时区；可含至多 3 位小数。会员区间为 startsAt <= now < expiresAt。'
    s['Refund']['properties']['version'] = api['VERSION']
    s['Refund']['required'].append('version')
    for name in ('OrderQuote', 'OrderDetail', 'AdminOrder'):
        s[name]['properties']['address'] = {**copy.deepcopy(s['AddressSnapshot']), 'nullable': True, 'description': '产品地址快照；课程订单为 null。'}
    s['OrderDetail']['description'] = '本人订单详情；课程订单 address=null，无运费和实物履约。'
    s['TestRefundInput']['description'] = '测试环境管理员模拟退款结果。课程退款 version 取退款流水，产品退款 version 取售后单。'
    s['VideoBodyWrite']['description'] = '引用 CONTENT_VIDEO 素材。LOCAL 为已上传 MP4；BILIBILI 仅科普；FEISHU 仅 MEMBER 视频课程非预览章。服务端不抓取远程视频、不转码。'
    s['PlaybackGrant']['description'] = '统一视频访问结果。STREAM 使用 5 分钟本地播放授权；EXTERNAL_LINK 跳转第三方页面。FEISHU 的 externalUrl/accessPassword 仅在会员或管理员预览授权通过后返回，禁止缓存。已返回的外部链接不会随网站会员撤销而在第三方自动失效。'
    s['PlaybackGrant']['properties'].update({
        'provider': enum('视频提供方。', 'LOCAL|BILIBILI|FEISHU'),
        'mode': enum('前端按此字段选择播放器或外部页面跳转。', 'STREAM|EXTERNAL_LINK'),
        'playbackUrl': {**api['URI'], 'nullable': True, 'description': '仅 LOCAL/STREAM 有值；外部模式为 null。', 'example': 'http://localhost:3000/api/v1/content-playback/media-id?token=example'},
        'externalUrl': {**api['URI'], 'nullable': True, 'description': '外部跳转地址；STREAM 为 null。FEISHU 视为敏感数据。', 'example': None},
        'accessPassword': {**string('仅授权 FEISHU 返回网盘访问密码；其他模式为 null。', minLength=1, maxLength=128), 'nullable': True, 'example': None},
        'expiresAt': {**api['NULL_TIME'], 'description': '本地播放授权到期时间；外链为 null，不表示第三方分享永久有效。'},
    })
    s['PlaybackGrant']['required'] += ['provider', 'mode', 'externalUrl', 'accessPassword']
    s['PlaybackGrant']['properties']['preview']['description'] = '整章免费预览；不是在完整付费视频上做客户端限时。'
    s['AdminBody']['properties']['bodyHtml']['maxLength'] = 500000
    obj('ContentImageCreate', '登记已托管公开 HTTPS 图片元数据。CONTENT_COVER/COLUMN_COVER 仅允许 CONTENT_IMAGE_OSS_HOST（默认 chunai-photo.oss-cn-hangzhou.aliyuncs.com），正文图片仍允许已有 HTTPS 地址。不会上传或下载文件。', {
        **copy.deepcopy(s['ProductImageCreate']['properties']),
        'purpose': enum('图片用途；引用时精确匹配。', 'CONTENT_COVER|COLUMN_COVER|CONTENT_BODY_IMAGE')})
    op('13 分类与内容管理', 'post', '/admin/content-media/images', '登记公开内容图片', auth='admin', permission='content:write', body='ContentImageCreate', data='MediaSummary', status=201)
    s['ContentImageCreate']['properties']['publicUrl']['example'] = 'https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/covers/replace-with-existing-object.jpg'
    for provider, name in [('BILIBILI', 'BilibiliVideoCreate'), ('FEISHU', 'FeishuVideoCreate')]:
        fields = {
            'provider': enum('外部视频提供方。', provider),
            'externalUrl': string('B 站仅 bilibili.com/www.bilibili.com 的 /video/BV+10位字母数字或 /video/av数字，及 b23.tv 的 4–64 位字母数字短链；飞书仅 feishu.cn 或一层租户子域，路径 /file/、/drive/file/、/drive/folder/ 加分享 token。拒绝用户名密码、显式端口、非空 fragment；保留普通 query。示例仅格式占位。',
                                  'https://www.bilibili.com/video/BV0000000000' if provider == 'BILIBILI' else 'https://example.feishu.cn/file/replace_with_real_share_id', format='uri', minLength=1, maxLength=2048),
            'durationSeconds': api['integer']('时长秒数；未知可填 0。', 0, 0, maximum=86400)}
        if provider == 'FEISHU':
            fields['accessPassword'] = string('飞书网盘访问密码，必须提供；与链接一起加密保存，不在素材响应或审计中返回。', 'replace-with-real-share-password', minLength=1, maxLength=128)
        obj(name, '登记 B 站科普视频，禁止传 accessPassword。' if provider == 'BILIBILI' else '登记飞书会员视频，必须提供 accessPassword。', fields)
    api['union']('ExternalVideoCreate', '外部视频来源二选一；链接与密码均加密保存。', ['BilibiliVideoCreate', 'FeishuVideoCreate'], 'provider')
    op('13 分类与内容管理', 'post', '/admin/content-media/external-videos', '登记 B 站／飞书视频', auth='admin', permission='content:write', body='ExternalVideoCreate', data='MediaSummary', status=201,
       note='只保存素材元数据与加密外部链接，响应不含 externalUrl/accessPassword；随后用返回 id 写入内容或章节 videoMediaId。需配置 CONTENT_MEDIA_ENCRYPTION_KEY。')
    op('17 用户与会员管理', 'put', '/admin/users/{id}/membership', '开通／续期网站会员', auth='admin', permission='membership:write', body='MembershipWrite', data='MembershipDetail',
       note='首次 version=0；续期先读取当前记录，再设置完整起止时间和 version。用户、会员记录与管理员权限在事务内校验；乐观锁避免覆盖并发更新。此操作不创建订单或收款。')
    op('17 用户与会员管理', 'post', '/admin/users/{id}/membership/revoke', '撤销网站会员', auth='admin', permission='membership:write', body='MembershipRevoke', data='MembershipDetail',
       note='立即停止新的会员访问授权。本地视频每次 Range 请求重查会员；已经交付的第三方链接／密码需在飞书端另行更新。')
    op('13 分类与内容管理', 'post', '/admin/content-media/videos', '上传私有 MP4', auth='admin', permission='content:write', data='MediaSummary', status=201,
       params=[query('durationSeconds', api['integer']('管理员填写的视频时长秒数。', 3, 1, maximum=86400), True)],
       note='请求 Content-Type: video/mp4，body 为原始文件字节，最大 100 MiB。保存在 CONTENT_MEDIA_DIR；视频 publicUrl 固定 null。须预先编码为浏览器兼容 MP4（建议 H.264/AAC），当前不转码。')
    op('03 视频、图文与专栏', 'get', '/content-playback/{id}', '读取授权视频字节', auth='public', response_kind='binary',
       params=[query('token', string('播放接口签发的短时令牌。', 'playback-grant', maxLength=4096), True),
               {'in': 'header', 'name': 'Range', 'required': False, 'schema': string('支持单个字节区间。', 'bytes=0-1023')}],
       note='只接受 aud=content-playback 的有效签名；校验原授权内容及当前会话和权益，不能直接用媒体 ID 下载。返回 video/mp4，支持 200、206 和 416，不套 JSON 成功外壳。')
    for method, path in [('post', '/admin/content-media/images'), ('post', '/admin/content-media/videos'),
                         ('post', '/admin/content-media/external-videos'), ('get', '/content-playback/{id}'),
                         ('put', '/admin/users/{id}/membership'), ('post', '/admin/users/{id}/membership/revoke')]:
        implemented.add((method, path))


def finalize_content_spec(spec):
    for path, methods in spec['paths'].items():
        if path.endswith('/playback'):
            for operation in methods.values():
                operation['responses']['200']['headers']['Cache-Control'] = {
                    'schema': {'type': 'string', 'example': 'private, no-store'},
                    'description': '包含授权链接的结果禁止缓存。'}
    spec['paths']['/admin/content-media/videos']['post']['requestBody'] = {
        'required': True, 'content': {'video/mp4': {'schema': {'type': 'string', 'format': 'binary'}}}}
    playback = spec['paths']['/content-playback/{id}']['get']
    for status in ('200', '206'):
        playback['responses'][status] = {'description': '授权 MP4 视频字节。', 'content': {'video/mp4': {'schema': {'type': 'string', 'format': 'binary'}}},
            'headers': {name: {'schema': {'type': 'string'}} for name in ('Content-Range', 'Accept-Ranges', 'Content-Length')}}
    playback['responses']['416'] = {'description': '非法或越界的 Range；Content-Range 返回总大小。'}
