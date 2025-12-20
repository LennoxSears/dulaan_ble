# OTA 测试指南 - 使用 nRF Connect

## 概述

自定义 OTA 使用 **WRITE + NOTIFY** 特征，不是 READ。

- **特征 UUID**: `9A531A2D-594F-4E2B-B123-5F739A2D594F`
- **属性**: WRITE + NOTIFY
- **协议**: 3 个命令（START, DATA, FINISH）

---

## 准备工作

### 1. 固件文件
编译后获取固件文件：
```
位置: SDK/cpu/bd19/tools/app.bin
格式: 原始二进制文件（无加密）
大小: 通常 < 80KB
```

### 2. 计算 CRC32
使用 Python 计算固件的 CRC32：

```python
import zlib

# 读取固件文件
with open('app.bin', 'rb') as f:
    firmware = f.read()

# 计算 CRC32
crc32 = zlib.crc32(firmware) & 0xFFFFFFFF
size = len(firmware)

print(f"文件大小: {size} bytes (0x{size:08X})")
print(f"CRC32: 0x{crc32:08X}")

# 生成命令
size_bytes = size.to_bytes(4, 'little')
crc_bytes = crc32.to_bytes(4, 'little')

print(f"\nSTART 命令: 01 {size_bytes.hex(' ')}")
print(f"FINISH 命令: 03 {crc_bytes.hex(' ')}")
```

**示例输出**:
```
文件大小: 45678 bytes (0x0000B26E)
CRC32: 0x12345678

START 命令: 01 6e b2 00 00
FINISH 命令: 03 78 56 34 12
```

---

## 使用 nRF Connect 测试 OTA

### 步骤 1: 连接设备

1. 打开 nRF Connect app
2. 扫描设备，找到 "VibMotor"
3. 点击 CONNECT
4. 接受配对请求（系统弹窗）

### 步骤 2: 找到 OTA 特征

1. 连接后，查看 GATT 服务列表
2. 找到服务: `9A501A2D-594F-4E2B-B123-5F739A2D594F`
3. 展开服务，找到特征:
   - `9A511A2D...` - Motor Control (马达控制)
   - `9A521A2D...` - Device Info (设备信息)
   - **`9A531A2D...` - OTA Update (固件升级)** ← 这个！

### 步骤 3: 启用通知

1. 点击 OTA 特征 (`9A531A2D...`)
2. 点击 **向下箭头图标** (Enable notifications)
3. 确认显示 "Notifications enabled"

⚠️ **重要**: 必须先启用通知，否则收不到设备响应！

### 步骤 4: 发送 START 命令

**格式**: `01 [size_low] [size_high] [size_mid] [size_top]`

**示例** (假设固件大小 45678 bytes = 0x0000B26E):
```
01 6E B2 00 00
```

**操作**:
1. 点击 OTA 特征的 **向上箭头图标** (Write)
2. 选择 "Byte array"
3. 输入: `01 6E B2 00 00`
4. 点击 SEND

**预期响应** (通知):
```
01 00  ← READY (准备就绪)
```

如果收到 `FF XX` (错误)，检查:
- `FF 02`: 固件大小无效（> 80KB）
- `FF 01`: START 命令格式错误

### 步骤 5: 发送固件数据

**格式**: `02 [seq_low] [seq_high] [data...]`

**重要**: 
- 每包最多 240 字节数据
- seq 是序号（从 0 开始）
- 数据按顺序发送

**示例** (发送前 240 字节):
```
包 0: 02 00 00 [240 bytes of firmware data]
包 1: 02 F0 00 [240 bytes of firmware data]
包 2: 02 E0 01 [240 bytes of firmware data]
...
```

**手动测试** (发送小文件):
```python
# 生成测试数据包
with open('app.bin', 'rb') as f:
    firmware = f.read()

chunk_size = 240
for i in range(0, len(firmware), chunk_size):
    seq = i // chunk_size
    chunk = firmware[i:i+chunk_size]
    
    # 构建数据包
    packet = bytes([0x02, seq & 0xFF, (seq >> 8) & 0xFF]) + chunk
    
    print(f"包 {seq}: 02 {seq & 0xFF:02X} {(seq >> 8) & 0xFF:02X} + {len(chunk)} bytes")
    print(f"  十六进制: {packet[:20].hex(' ')}...")
```

**预期响应** (每 10% 进度):
```
02 0A  ← 10%
02 14  ← 20%
02 1E  ← 30%
...
02 64  ← 100%
```

### 步骤 6: 发送 FINISH 命令

**格式**: `03 [crc_low] [crc_high] [crc_mid] [crc_top]`

**示例** (假设 CRC32 = 0x12345678):
```
03 78 56 34 12
```

**操作**:
1. 点击 OTA 特征的 **向上箭头图标** (Write)
2. 输入: `03 78 56 34 12`
3. 点击 SEND

**预期响应**:
```
03 00  ← SUCCESS (成功)
```

设备会在 100ms 后自动重启。

**如果收到错误**:
- `FF 08`: 大小不匹配（接收的数据量 ≠ 声明的大小）
- `FF 09`: CRC 校验失败（固件损坏或 CRC 计算错误）

---

## 完整测试脚本

### Python 脚本 (使用 bleak 库)

```python
import asyncio
import zlib
from bleak import BleakClient, BleakScanner

# UUIDs
SERVICE_UUID = "9A501A2D-594F-4E2B-B123-5F739A2D594F"
OTA_CHAR_UUID = "9A531A2D-594F-4E2B-B123-5F739A2D594F"

async def ota_upload(firmware_path):
    # 1. 读取固件
    with open(firmware_path, 'rb') as f:
        firmware = f.read()
    
    size = len(firmware)
    crc32 = zlib.crc32(firmware) & 0xFFFFFFFF
    
    print(f"固件大小: {size} bytes")
    print(f"CRC32: 0x{crc32:08X}")
    
    # 2. 扫描设备
    print("\n扫描设备...")
    device = await BleakScanner.find_device_by_name("VibMotor")
    if not device:
        print("未找到设备")
        return
    
    # 3. 连接
    async with BleakClient(device) as client:
        print(f"已连接: {device.name}")
        
        # 4. 启用通知
        notifications = []
        def notification_handler(sender, data):
            notifications.append(data)
            status = data[0]
            value = data[1] if len(data) > 1 else 0
            
            if status == 0x01:
                print("  ← READY")
            elif status == 0x02:
                print(f"  ← PROGRESS: {value}%")
            elif status == 0x03:
                print("  ← SUCCESS")
            elif status == 0xFF:
                print(f"  ← ERROR: 0x{value:02X}")
        
        await client.start_notify(OTA_CHAR_UUID, notification_handler)
        print("通知已启用")
        
        # 5. 发送 START
        start_cmd = bytes([0x01]) + size.to_bytes(4, 'little')
        print(f"\n发送 START: {start_cmd.hex(' ')}")
        await client.write_gatt_char(OTA_CHAR_UUID, start_cmd)
        await asyncio.sleep(0.5)
        
        # 6. 发送数据
        chunk_size = 240
        total_chunks = (size + chunk_size - 1) // chunk_size
        
        print(f"\n发送数据: {total_chunks} 包")
        for i in range(0, size, chunk_size):
            seq = i // chunk_size
            chunk = firmware[i:i+chunk_size]
            
            data_cmd = bytes([0x02]) + seq.to_bytes(2, 'little') + chunk
            await client.write_gatt_char(OTA_CHAR_UUID, data_cmd, response=False)
            
            if seq % 10 == 0:
                print(f"  发送包 {seq}/{total_chunks}")
            
            await asyncio.sleep(0.02)  # 20ms 延迟
        
        print("数据发送完成")
        await asyncio.sleep(1)
        
        # 7. 发送 FINISH
        finish_cmd = bytes([0x03]) + crc32.to_bytes(4, 'little')
        print(f"\n发送 FINISH: {finish_cmd.hex(' ')}")
        await client.write_gatt_char(OTA_CHAR_UUID, finish_cmd)
        await asyncio.sleep(2)
        
        print("\nOTA 完成！设备将重启...")

# 运行
asyncio.run(ota_upload("app.bin"))
```

**安装依赖**:
```bash
pip install bleak
```

**运行**:
```bash
python ota_upload.py
```

---

## 错误码参考

| 错误码 | 说明 | 解决方法 |
|--------|------|----------|
| 0x01 | START 包长度错误 | 确保发送 5 字节 (01 + 4 字节大小) |
| 0x02 | 固件大小无效 | 检查固件 < 80KB |
| 0x03 | 未处于接收状态 | 先发送 START 命令 |
| 0x04 | DATA 包长度错误 | 确保至少 4 字节 (02 + seq + data) |
| 0x05 | Flash 写入失败 | 检查 VM 区域配置 |
| 0x06 | 未处于接收状态 | 先发送 START 命令 |
| 0x07 | FINISH 包长度错误 | 确保发送 5 字节 (03 + 4 字节 CRC) |
| 0x08 | 大小不匹配 | 发送的数据量与声明不符 |
| 0x09 | CRC 校验失败 | 重新计算 CRC32 |
| 0xFF | 未知命令 | 检查命令字节 (01/02/03) |

---

## 常见问题

### Q: 发送命令后没有响应？
A: 检查是否启用了通知。必须先点击向下箭头启用通知。

### Q: 收到 "FF 02" 错误？
A: 固件大小超过 80KB。检查 `app.bin` 文件大小。

### Q: 收到 "FF 09" 错误？
A: CRC 校验失败。确保：
1. CRC32 计算正确（使用标准算法）
2. 发送的数据完整无损
3. 字节序正确（little-endian）

### Q: 如何验证 CRC32 计算？
A: 使用在线工具验证：
```bash
# Linux/Mac
crc32 app.bin

# Python
python -c "import zlib; print(hex(zlib.crc32(open('app.bin','rb').read()) & 0xFFFFFFFF))"
```

### Q: 可以用其他 BLE 工具吗？
A: 可以！任何支持 BLE GATT 的工具都可以：
- LightBlue (iOS/Mac)
- BLE Scanner (Android)
- Web Bluetooth (Chrome)
- 自定义 Android/iOS app

---

## 广播包说明

设备广播包内容：
```
设备名称: "VibMotor"
服务 UUID: 9A501A2D-594F-4E2B-B123-5F739A2D594F (在广播包中)
可连接: 是
配对: LESC + Just-Works (首次连接需要配对)
```

扫描时可以通过服务 UUID 过滤设备。

---

## 总结

1. ✅ OTA 特征使用 **WRITE + NOTIFY**，不是 READ
2. ✅ 必须先启用通知才能收到响应
3. ✅ 使用 `app.bin` 文件（原始二进制）
4. ✅ 3 个命令：START → DATA (多次) → FINISH
5. ✅ 设备会发送进度通知和最终结果
6. ✅ 成功后自动重启

**测试建议**:
- 先用小文件测试（< 10KB）
- 验证 CRC32 计算正确
- 观察通知响应
- 确认设备重启

有问题随时问！
