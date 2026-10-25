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
                if p['name'] == 'scope': p['schema'] = enum('分类作用域；公共列表省略时默认 PRODUCT。', 'CONTENT|PRODUCT')
            o['note'] = '支持 CONTENT 和 PRODUCT；父子分类必须同域。被子分类、产品或内容引用时不可删除。'
        if path in ('/articles', '/videos'):
            o['params'].append(query('tag', string('精确匹配公开标签。', 'cs', minLength=1, maxLength=20)))
        if path.startswith(('/articles', '/videos', '/courses/', '/chapters/', '/columns')):
            o['note'] = o['note'].replace('／会员权益', '权益').replace('购买／会员权益', '购买权益')
        if path == '/admin/orders/{id}/digital-refund':
            o['note'] = '当前只支持 COURSE 全额退款；orderVersion 为订单版本。创建 PROCESSING 退款不会撤销访问权；测试退款成功才原子撤权并关闭订单。FAILED 可用同接口和最新订单版本重试，重用退款 ID。'
        if path == '/admin/refunds/{id}/test-result':
            o['note'] = '仅 TEST 支付；课程退款 version 为退款流水版本，产品售后仍为售后单版本。成功才改金额并撤销本订单课程权益，失败保留权益。'
        if path in ('/admin/contents/{id}/body', '/admin/chapters/{id}/body'):
            o['note'] = '图文传 bodyHtml + imageMediaIds，视频只传 videoMediaId，不能混用。正文图片必须是 CONTENT_BODY_IMAGE 素材；禁止任意源地址。视频为管理员上传的可直接播放 MP4，当前无转码。'
        if path == '/admin/chapters/{id}/unpublish':
            o['note'] = '下架最后一章时自动下架课程，并增加课程版本。已购用户可继续读取历史已发布章节；草稿始终不可见。'
        if path == '/admin/contents/{id}' and o['method'] == 'delete':
            o['note'] = '只物理删除从未发布、没有章节、专栏、报价或订单引用的草稿；已发布内容保留历史，使用下架。'
        if path == '/admin/columns/{id}' and o['method'] == 'delete':
            o['note'] = '先下架专栏再删除；同时移除分组关联，内容、课程和购买权益保留。'
    api['union']('ImplementedPurchase', '当前可用的商品或课程试算，不包含会员购买。', ['ProductPurchase', 'CoursePurchase'], 'type')
    s['CategoryCreate']['properties']['scope'] = enum('作用域。', 'CONTENT|PRODUCT')
    for name in ('ContentCreate', 'ContentPatch', 'ContentSummary', 'ContentDetail', 'AdminContent'):
        s[name]['properties']['accessPolicy'] = enum('已实现免费与单独购买；会员服务尚未接入。', 'FREE|PURCHASE')
    s['Refund']['properties']['version'] = api['VERSION']
    s['Refund']['required'].append('version')
    for name in ('OrderQuote', 'OrderDetail', 'AdminOrder'):
        s[name]['properties']['address'] = {**copy.deepcopy(s['AddressSnapshot']), 'nullable': True, 'description': '产品地址快照；课程订单为 null。'}
    s['OrderDetail']['description'] = '本人订单详情；课程订单 address=null，无运费和实物履约。'
    s['TestRefundInput']['description'] = '测试环境管理员模拟退款结果。课程退款 version 取退款流水，产品退款 version 取售后单。'
    s['VideoBodyWrite']['description'] = '仅已上传的 MP4 素材，CONTENT_VIDEO 用途；服务端不抓取远程视频，不进行转码。'
    s['PlaybackGrant']['description'] = '5 分钟播放 URL；每次请求重新校验会话、内容状态、章节预览与购买权益。成功退款或退出会话后旧链接失效。'
    s['PlaybackGrant']['properties']['preview']['description'] = '整章免费预览；不是在完整付费视频上做客户端限时。'
    s['AdminBody']['properties']['bodyHtml']['maxLength'] = 500000
    obj('ContentImageCreate', '登记已托管公开 HTTPS 图片元数据；限制内容封面、专栏封面或正文图片用途。', {
        **copy.deepcopy(s['ProductImageCreate']['properties']),
        'purpose': enum('图片用途；引用时精确匹配。', 'CONTENT_COVER|COLUMN_COVER|CONTENT_BODY_IMAGE')})
    op('13 分类与内容管理', 'post', '/admin/content-media/images', '登记公开内容图片', auth='admin', permission='content:write', body='ContentImageCreate', data='MediaSummary', status=201)
    op('13 分类与内容管理', 'post', '/admin/content-media/videos', '上传私有 MP4', auth='admin', permission='content:write', data='MediaSummary', status=201,
       params=[query('durationSeconds', api['integer']('管理员填写的视频时长秒数。', 3, 1, maximum=86400), True)],
       note='请求 Content-Type: video/mp4，body 为原始文件字节，最大 100 MiB。保存在 CONTENT_MEDIA_DIR；视频 publicUrl 固定 null。须预先编码为浏览器兼容 MP4（建议 H.264/AAC），当前不转码。')
    op('03 视频、图文与专栏', 'get', '/content-playback/{id}', '读取授权视频字节', auth='public', response_kind='binary',
       params=[query('token', string('播放接口签发的短时令牌。', 'playback-grant', maxLength=4096), True),
               {'in': 'header', 'name': 'Range', 'required': False, 'schema': string('支持单个字节区间。', 'bytes=0-1023')}],
       note='只接受 aud=content-playback 的有效签名；校验原授权内容及当前会话和权益，不能直接用媒体 ID 下载。返回 video/mp4，支持 200、206 和 416，不套 JSON 成功外壳。')
    for method, path in [('post', '/admin/content-media/images'), ('post', '/admin/content-media/videos'), ('get', '/content-playback/{id}')]:
        implemented.add((method, path))


def finalize_content_spec(spec):
    spec['paths']['/admin/content-media/videos']['post']['requestBody'] = {
        'required': True, 'content': {'video/mp4': {'schema': {'type': 'string', 'format': 'binary'}}}}
    playback = spec['paths']['/content-playback/{id}']['get']
    for status in ('200', '206'):
        playback['responses'][status] = {'description': '授权 MP4 视频字节。', 'content': {'video/mp4': {'schema': {'type': 'string', 'format': 'binary'}}},
            'headers': {name: {'schema': {'type': 'string'}} for name in ('Content-Range', 'Accept-Ranges', 'Content-Length')}}
    playback['responses']['416'] = {'description': '非法或越界的 Range；Content-Range 返回总大小。'}
