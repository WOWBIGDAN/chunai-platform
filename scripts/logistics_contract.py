"""Aliyun polling integration and shipment management contract."""
import copy


def apply_logistics_contract(api):
    schemas = api['SCHEMAS']
    enum, string = api['enum'], api['string']
    schemas['Shipment']['properties']['status'] = enum('物流状态；RETURNED 是退件签收，不是买家签收，也不会自动退款或入库。', 'PENDING_PICKUP|IN_TRANSIT|OUT_FOR_DELIVERY|DELIVERED|EXCEPTION|RETURNED')
    schemas['LogisticsEvent']['properties']['source'] = enum('来源：人工登记或阿里云物流服务。', 'MANUAL|ALIYUN')
    properties = schemas['LogisticsResult']['properties']
    properties['shipment'] = {**copy.deepcopy(schemas['Shipment']), 'nullable': True}
    properties['syncStatus'] = enum('未发货、未配置服务、待查询、查询中、查询成功、无轨迹或查询失败；失败时保留已有轨迹。', 'NOT_SHIPPED|MANUAL|PENDING|SYNCING|UP_TO_DATE|NO_DATA|FAILED')
    properties['syncErrorCode'] = {**string('查询失败的稳定错误代码，见物流文档；不包含供应商原文或凭证。', 'LOGISTICS_NO_DATA'), 'nullable': True}
    properties['lastSyncAttemptAt'] = api['NULL_TIME']
    properties['nextSyncAt'] = {**api['NULL_TIME'], 'description': '最早自动重查时间；终态、超出自动追踪期限、关闭订单或未配置服务时为 null。调度可能延后。'}
    schemas['LogisticsResult']['required'] += ['syncErrorCode', 'lastSyncAttemptAt', 'nextSyncAt']
    for name in ['ShipmentCreate', 'ShipmentPatch']:
        schemas[name]['properties']['phoneLast4'] = string('可选收/寄件人手机号后四位；省略时发货默认使用订单收件手机尾号。查询时按公司要求附加，返回体不回显。', '1234', pattern=r'^\d{4}$')
    schemas['ShipmentPatch']['properties']['phoneLast4']['nullable'] = True
    schemas['ShipmentPatch']['description'] = '揽收前且无轨迹才可改公司/单号；同一公司/单号可单独纠正查询手机尾号。省略尾号保留旧值，null 恢复使用订单收件手机尾号。需 version 和原因。'
    api['obj']('LogisticsCarrier', '平台支持的公司与查询要求；前端应使用此列表。', {
        'code': string('平台快递代码。', 'SF'), 'name': string('公司名称。', '顺丰速运'),
        'phoneLast4Required': api['boolean']('服务商是否要求手机尾号；不传则使用订单地址快照的手机尾号。', True)})
    api['obj']('LogisticsCarriers', '当前支持的快递公司。', {'items': api['array']('LogisticsCarrier', '公司列表')})
    start = len(api['OPERATIONS'])
    api['op']('16 订单、物流与售后管理', 'get', '/admin/logistics/carriers', '查询可用快递公司', auth='admin', permission='orders:ship', data='LogisticsCarriers')
    api['op']('16 订单、物流与售后管理', 'post', '/admin/shipments/{id}/sync', '主动同步出库物流轨迹', auth='admin', permission='orders:ship', body='VersionInput', data='LogisticsResult',
              note='提交当前 shipment.version。只允许已发货实物订单（PENDING_RECEIPT/COMPLETED）。同运单至少间隔 60 秒，过频 429；已有查询执行中返回 SYNCING。HTTP 200 中的 syncStatus=FAILED/NO_DATA 表示上游失败/暂无轨迹；保留既有轨迹，不能当作签收。无需幂等键，数据库租约阻止并发计费。未配置服务 503。可补查已签收、退回或超过自动追踪期的单据。')
    api['IMPLEMENTED'].update((o['method'], o['path']) for o in api['OPERATIONS'][start:])
    for operation in api['OPERATIONS']:
        if operation['path'] in ['/orders/{id}/logistics', '/admin/orders/{id}/logistics']:
            operation['note'] = '用户仅查本人；管理端需 orders:read。启用物流服务后按缓存到期同步，再返回最近 100 条轨迹；默认 30 分钟查询间隔，并发查询复用数据库租约。后台每分钟批量扫描，默认自动追踪发货后 30 天；已签收、退件签收或关闭订单停止自动查询。上游故障仍返回已有轨迹和 FAILED，暂无轨迹为 NO_DATA。未配置服务仍支持人工轨迹。快递签收不会自动完成订单。'
        if operation['path'] == '/admin/shipments/{id}' and operation['method'] == 'patch':
            operation['note'] = schemas['ShipmentPatch']['description'] + '纠错使旧查询结果失效；尾号不写审计或响应。'
        if operation['path'] == '/admin/orders/{id}/shipment':
            operation['note'] += ' 可选 phoneLast4；只能填四位数字，单号不含冒号或电话。发货提交不等待外部服务；后台或物流详情读取触发首次查询。'
