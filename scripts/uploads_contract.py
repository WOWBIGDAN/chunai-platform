"""Unified OSS uploads, owned media and private after-sale evidence contract."""
import copy


def apply_uploads_contract(api):
    schemas, operations, implemented = (api[name] for name in ('SCHEMAS', 'OPERATIONS', 'IMPLEMENTED'))
    obj, string, integer, enum, ref = (api[name] for name in ('obj', 'string', 'integer', 'enum', 'ref'))
    uuid = string('服务端生成的 UUID；uploadId 与 mediaId 相同。', 'e17c8ad0-8f08-4a4b-8a77-2b730ab323da', format='uuid')
    obj('UploadImageCreate', '图片直传申请；JPEG、PNG、WebP，最大 10 MiB；所有文件先上传到私有临时区域。', {
        'purpose': enum('用户仅 AVATAR／AFTERSALE_EVIDENCE；管理员内容用途需要 media:write + content:write，产品图片需要 media:write + products:write。',
                        'AVATAR|AFTERSALE_EVIDENCE|CONTENT_COVER|CONTENT_BODY_IMAGE|PRODUCT_IMAGE|COLUMN_COVER'),
        'fileName': string('原始显示名称，不作为对象路径；拒绝路径分隔符与控制字符。', 'cs-avatar.png', minLength=1, maxLength=200),
        'mimeType': enum('申请 MIME，完成后检查真实对象头与文件特征。', 'image/jpeg|image/png|image/webp', 'image/png'),
        'sizeBytes': integer('精确文件大小；OSS POST 策略及完成确认都会校验。', 1024, 1, maximum=10485760)})
    obj('UploadVideoCreate', '仅管理员，需 media:write + content:write；MP4 最大 100 MiB，私有存储，不转码。', {
        'purpose': enum('视频固定用途。', 'CONTENT_VIDEO'),
        'fileName': copy.deepcopy(schemas['UploadImageCreate']['properties']['fileName']),
        'mimeType': enum('仅 MP4。', 'video/mp4'),
        'sizeBytes': integer('精确文件大小。', 102400, 1, maximum=104857600),
        'durationSeconds': integer('可省略，默认 0 表示未知；管理员提供时长，不提供自动探测或转码。', 3, 0, maximum=86400)}, ['purpose', 'fileName', 'mimeType', 'sizeBytes'])
    schemas['UploadVideoCreate']['properties']['fileName']['example'] = 'cs-video.mp4'
    api['union']('UploadCreate', '图片或私有 MP4 二选一；图片不能携带 durationSeconds。', ['UploadImageCreate', 'UploadVideoCreate'])
    obj('UploadTicket', '十分钟有效的 OSS POST 表单授权；返回字段原样作为 multipart/form-data 的文本字段，最后追加 file。文件不经业务 API 上传。', {
        'uploadId': uuid, 'mediaId': uuid, 'method': enum('固定为表单 POST，不能按 PUT 上传。', 'POST'),
        'uploadUrl': string('私有 Bucket 的 HTTPS OSS 地址。', 'https://your-private-bucket.oss-cn-hangzhou.aliyuncs.com', format='uri'),
        'fields': {'type': 'object', 'description': '服务端签发的表单字段；不可改写 key、policy、Content-Type、签名或临时令牌。签名只允许上传本次指定对象。',
                   'additionalProperties': {'type': 'string'}, 'example': {'key': 'uploads/staging/e17c8ad0-8f08-4a4b-8a77-2b730ab323da.png', 'Content-Type': 'image/png', 'success_action_status': '201', 'policy': 'replace-with-server-policy', 'x-oss-signature': 'replace-with-server-signature'}},
        'expiresAt': api['TIME']})
    schemas['MediaSummary']['properties']['status'] = enum('统一上传状态：UPLOADING 待确认；READY 可引用；FAILED 校验失败；DELETED 已逻辑删除。旧素材接口直接返回 READY。',
                                                         'UPLOADING|READY|FAILED|DELETED', 'READY')
    schemas['MediaSummary']['properties']['publicUrl']['description'] = '仅 READY 的公开图片返回稳定 OSS URL；待上传、失败、已删除、售后凭证及私有视频均为 null。'
    schemas['MediaSummary']['properties']['provider']['description'] = '统一上传为 OSS；保留旧素材来源；不包含存储凭证、内部对象路径或受保护视频链接。'
    schemas['PrivateEvidenceMedia'] = copy.deepcopy(schemas['MediaSummary'])
    schemas['PrivateEvidenceMedia']['description'] = '本人提交的私有售后图片摘要；publicUrl 永远为 null。经 read-grant 获取短时应用代理地址。'
    schemas['PrivateEvidenceMedia']['properties']['publicUrl'] = {
        'type': 'string', 'nullable': True, 'enum': [None], 'description': '固定 null，不暴露 OSS 私有地址。', 'example': None}
    schemas['UserPatch']['properties']['avatarMediaId'] = {**uuid, 'nullable': True,
        'description': '本人上传、用途 AVATAR、状态 READY 的素材 ID；null 清空头像。与 avatarUrl 互斥。'}
    schemas['UserPatch']['not'] = {'required': ['avatarUrl', 'avatarMediaId']}
    schemas['UserPatch']['description'] = '当前 version 与至少一个修改字段：nickname、avatarMediaId 或兼容字段 avatarUrl；两种头像字段互斥，头像 ID 仅接受本人 READY AVATAR。'
    schemas['UserPatch']['properties']['avatarUrl']['description'] += ' 优先使用统一上传返回的 avatarMediaId。通过 URL 引用系统管理的头像时同样校验所有者，不能绑定他人上传的文件。'
    schemas['AfterSaleCreate']['properties']['evidenceMediaIds']['description'] = '最多 9 个不重复的本人 READY AFTERSALE_EVIDENCE 图片 ID；与售后创建在同一事务内校验并绑定。可省略或传 [] 提交纯文字说明。'
    schemas['MediaReadGrant']['description'] = '私有售后凭证读取授权，有效 60 秒，绑定当前账户、会话及素材；每次读取重查权限、封禁和售后关联。'
    schemas['MediaReadGrant']['properties']['url'] = string('应用代理 URL；不是 OSS 永久地址或可脱离平台权限使用的存储签名。不要记录到日志或公共缓存。',
        'http://localhost:3000/api/v1/media/e17c8ad0-8f08-4a4b-8a77-2b730ab323da/file?token=replace-with-read-grant', format='uri')
    notes = {
        ('post', '/uploads'): '普通用户可上传本人头像和售后凭证。管理员内容素材须 media:write + content:write，产品图片须 media:write + products:write。全部文件先上传到私有临时区域；缺少 OSS 凭证或任一 Bucket 配置时返回 503，不签发假上传地址。无需幂等键，每次创建新票据；每个账户最多 20 个有效待完成申请，滚动 24 小时用户限 100 个、管理员限 500 个。',
        ('post', '/uploads/{id}/complete'): '上传到 OSS 成功后调用，无请求体。服务端校验实际大小、MIME 与文件特征，复制到新的最终对象后才变为 READY；公开图片发布到公开 Bucket，证据和 MP4 保持私有。重复成功确认返回原素材；不转码。',
        ('get', '/media/{id}'): '普通用户仅查询本人上传；管理员查询后台用途素材需 media:write 和对应内容／产品权限，读取已绑定售后的 READY 凭证需 aftersales:review。不返回临时 key、私有源地址或凭证。',
        ('delete', '/media/{id}'): '仅本人未引用素材；管理员仍需对应用途权限。头像、商品、正文、内容封面、专栏、有效报价／历史订单或售后凭证仍引用时返回 MEDIA_IN_USE。先逻辑删除，票据过期 60 秒后后台清理对象并重试失败清理。重复删除成功，无需幂等键。',
        ('post', '/media/{id}/read-grant'): '仅 READY AFTERSALE_EVIDENCE 图片。本人可预览；管理员须 aftersales:review，且素材已绑定售后。返回 60 秒应用代理地址；每次读取重查当前会话、账号及关联。内容视频使用现有播放授权接口。',
        ('patch', '/me'): '先 GET /me 获取 version；修改 nickname，或传本人 READY AVATAR 素材的 avatarMediaId（null 清空）。avatarUrl 作为兼容路径保留，与 avatarMediaId 互斥；管理上传地址仍须本人所有。版本冲突返回 409。',
    }
    managed = {path for method, path in notes if path.startswith('/uploads') or path.startswith('/media')}
    for operation in operations:
        pair = (operation['method'], operation['path'])
        if pair in notes:
            operation['note'] = notes[pair]
        if operation['path'] in managed:
            implemented.add(pair)
        if operation['path'] in ('/videos/{id}/playback', '/chapters/{id}/playback'):
            operation['note'] += ' OSS 私有 MP4 与 LOCAL 共用 STREAM 授权及应用代理流，每次 Range 请求重查权益。'
    schemas['PlaybackGrant']['properties']['provider']['enum'] = ['LOCAL', 'OSS', 'BILIBILI', 'FEISHU']
    schemas['PlaybackGrant']['properties']['playbackUrl']['description'] = 'LOCAL 或 OSS 的 STREAM 返回短时应用代理地址；外链模式为 null。'
    schemas['PlaybackGrant']['properties']['expiresAt']['description'] = 'STREAM 播放授权到期时间；外链模式为 null。'
    schemas['VideoBodyWrite']['description'] = '引用 READY CONTENT_VIDEO 素材。LOCAL／OSS 为私有 MP4；BILIBILI 仅科普；FEISHU 仅 MEMBER 视频课程非预览章。'
    schemas['ProductImageCreate']['description'] = '兼容登记已经托管的公开 HTTPS 产品图片；该接口不检查远程字节。新文件可通过统一上传完成校验后直接取得相同用途的素材 ID。'
    schemas['ContentImageCreate']['description'] += ' 新文件可改走统一上传；完成后直接使用返回素材 ID，无须重复登记。'
    api['op']('11 文件与媒体', 'get', '/media/{id}/file', '读取授权私有售后凭证', auth='public', response_kind='binary',
              params=[api['query']('token', string('read-grant 签发的 60 秒短时令牌。', 'replace-with-read-grant', maxLength=4096), True)],
              note='返回原始图片字节，不套 JSON 成功外壳；每次读取重查素材状态、账户与会话。管理员还需当前 aftersales:review 权限及售后关联。不能用普通登录 JWT 代替授权令牌。')
    implemented.add(('get', '/media/{id}/file'))


def finalize_uploads_spec(spec):
    stream = spec['paths']['/media/{id}/file']['get']
    stream['responses']['200'] = {'description': '授权私有售后凭证图片。',
        'content': {mime: {'schema': {'type': 'string', 'format': 'binary'}} for mime in ('image/jpeg', 'image/png', 'image/webp')},
        'headers': {'Cache-Control': {'schema': {'type': 'string', 'example': 'private, no-store'}},
                    'Content-Length': {'schema': {'type': 'string'}},
                    'X-Content-Type-Options': {'schema': {'type': 'string', 'example': 'nosniff'}}}}
    for path in ('/uploads', '/uploads/{id}/complete', '/media/{id}'):
        for operation in spec['paths'][path].values():
            operation['x-conditional-permissions'] = {
                'client': {'purposes': ['AVATAR', 'AFTERSALE_EVIDENCE'], 'ownerOnly': True},
                'admin': {'PRODUCT_IMAGE': ['media:write', 'products:write'],
                          'CONTENT_COVER|COLUMN_COVER|CONTENT_BODY_IMAGE|CONTENT_VIDEO': ['media:write', 'content:write']}}
    spec['paths']['/media/{id}']['get']['x-conditional-permissions']['admin']['AFTERSALE_EVIDENCE'] = {
        'permissions': ['aftersales:review'], 'requiresLinkedAfterSale': True}
    spec['paths']['/media/{id}/read-grant']['post']['x-conditional-permissions'] = {
        'client': {'ownerOnly': True, 'purpose': 'AFTERSALE_EVIDENCE'},
        'admin': {'permissions': ['aftersales:review'], 'requiresLinkedAfterSale': True}}
