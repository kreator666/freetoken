# dsh-realsee-agent

基于 [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) 的插件化 Agent，用于：

1. **照片生成如视 VR 实景合影**：把用户照片中的人物抠出并合成到如视 VR 全景场景中。
2. **照片生成如视 VR 实景视频**（第二阶段）：基于照片生成人物在 VR 实景中移动的短视频。

## 项目结构

```
dsh/
├── src/                         # TypeScript / dsh 插件代码
│   ├── index.ts                 # 插件入口与 context factory
│   ├── config.ts                # 环境配置
│   ├── types.ts                 # 共享类型
│   ├── services/                # seam 能力层
│   │   ├── realsee/             # 如视场景获取
│   │   └── image/               # 图像处理
│   ├── tools/                   # Agent 可调用的 tools
│   │   ├── realsee.tool.ts
│   │   └── image.tool.ts
│   └── utils/
│       └── python-runner.ts     # 调用 Python 后端的封装
├── python/                      # Python 处理后端
│   ├── realsee_adapter.py       # 如视全景图/元数据获取
│   ├── image_pipeline.py        # 抠图 + 透视 + 合影合成
│   └── video_pipeline.py        # 视频生成（第二阶段）
├── web/                         # Node.js Web UI
│   ├── server.ts                # HTTP 服务
│   └── public/
│       └── index.html           # 前端操作页面
├── examples/
│   └── group-photo.demo.ts      # 合影 demo
└── assets/                      # 输入/输出目录（运行时创建）
```

## 前置要求

- Node.js `^22.19.0 || >=24.0.0`
- pnpm `11.7.0`（推荐用 `corepack enable` 启用）
- Python `>=3.10`

## 安装

### 1. 安装 Node 依赖

```bash
pnpm install
```

### 2. 安装 Python 依赖

```bash
cd python
pip install -e ".[gpu]"    # 若本地有 GPU，安装 torch + bria-rmbg
# 或
pip install -e .           # 仅 CPU 依赖，使用 GrabCut fallback 抠图
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY
# 如视 API Key 可选，MVP 可用本地全景图或 URL
```

## 运行合影 Demo

### 方式一：Web UI（推荐）

启动 Node.js Web 服务：

```bash
pnpm web
# 或指定端口
WEB_PORT=3081 pnpm web
```

打开浏览器访问 `http://127.0.0.1:3081`：

1. 上传人物照片（建议人物居中、背景不太复杂的正面照）
2. 上传 VR 全景图（推荐 2:1 等距圆柱全景图；或先下载示例：`python scripts/download-sample-panorama.py`）
3. 调整 yaw/pitch/distance/scale 等参数
4. 点击「生成合影」，页面会显示结果图片

> 当前 MVP 使用轻量级 fallback 抠图，只能粗略提取人物中心区域。要获得完整、干净的抠图效果，请安装 GPU 依赖 `pip install -e ".[gpu]"`，或等待第二步接入 `bria-rmbg` / SAM2。

### 方式二：命令行

准备：

- 一张全景图放到 `assets/sample-panorama.jpg`（可用 `python scripts/download-sample-panorama.py` 下载示例）
- 一张含有人物的照片放到 `assets/sample-person.jpg`

或者用脚本生成测试素材（见下方）。

执行：

```bash
pnpm demo:photo
```

或直接调用 Python pipeline：

```bash
# 1. 抠图
python python/image_pipeline.py segment \
  --input assets/sample-person.jpg \
  --output-dir assets/temp/person

# 2. 合成合影
python python/image_pipeline.py group-photo \
  --person assets/temp/person/person.png \
  --scene assets/sample-panorama.jpg \
  --output assets/output/group-photo.jpg \
  --yaw 0 --pitch 0 --distance 3 --shadow --lighting
```

## 生成测试素材

如果你没有现成的全景图和人物照片，可以用 Python 生成简单的测试图：

```bash
python - <<'PY'
from PIL import Image, ImageDraw
import math

# 简单全景图：蓝色天空 + 绿色地面 + 红色柱子
w, h = 4096, 2048
img = Image.new('RGB', (w, h), (135, 206, 235))
d = ImageDraw.Draw(img)
d.rectangle([0, h//2, w, h], fill=(34, 139, 34))
for i in range(0, w, w//8):
    d.rectangle([i + 40, h//2 - 300, i + 100, h//2], fill=(180, 60, 60))
img.save('assets/sample-panorama.jpg')

# 简单人物照片：紫色人形剪影
pw, ph = 512, 768
pimg = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
d = ImageDraw.Draw(pimg)
d.ellipse([pw*0.35, ph*0.05, pw*0.65, ph*0.25], fill=(147, 112, 219, 255))
d.rectangle([pw*0.35, ph*0.25, pw*0.65, ph*0.85], fill=(147, 112, 219, 255))
d.rectangle([pw*0.25, ph*0.35, pw*0.40, ph*0.75], fill=(147, 112, 219, 255))
d.rectangle([pw*0.60, ph*0.35, pw*0.75, ph*0.75], fill=(147, 112, 219, 255))
pimg.save('assets/sample-person.jpg')
print('done')
PY
```

## 接入 DeepSeek Harness (dsh)

当前代码已实现了一个 **standalone context factory**（`src/index.ts` 中的 `createContext`），可以直接在脚本或测试中调用。

要作为 dsh 插件加载，需要把 `services/*` 注册到 Cordis 容器，并把 `tools/*` 注册到 dsh 的 tool registry。由于 `deepseek-harness` 源码未在本地，以下是预期接入方式：

```ts
// src/plugin.ts (dsh 插件入口示例)
import { Context, Service } from '@deepseek-ai/dsh'
import { RealseeConsumer } from './services/realsee/consumer.js'
import { ImageConsumer } from './services/image/consumer.js'
import { realseeTools, imageTools } from './tools/index.js'

export const name = 'realsee-agent'

export function apply(ctx: Context) {
  ctx.plugin('realsee-agent', {
    apply(ctx) {
      ctx.service('realsee', RealseeConsumer)
      ctx.service('image', ImageConsumer)

      for (const tool of [...realseeTools.tools, ...imageTools.tools]) {
        ctx.effect(() => ctx.registry('tool').register(tool.name, tool))
      }
    },
  })
}
```

> 具体装饰器和注册 API（`ctx.service`、`ctx.registry` 等）需要对照本地 `deepseek-harness` 源码微调。

## 下一步

- [ ] 接入真实如视 OpenAPI（替换 `python/realsee_adapter.py` 的 MVP fallback）
- [ ] 接入高质量人像抠图模型 `bria-rmbg` 或 SAM2
- [ ] 接入光影融合模型 `IC-Light` / `ControlNet`
- [ ] 实现第二阶段视频生成功能
- [ ] 接入 dsh Cordis 容器，完成真实插件化
