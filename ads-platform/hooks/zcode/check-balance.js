#!/usr/bin/env node
// 在 ZCode SessionStart 时检查已配置模型 provider 的余额/可用性
// 余额低时打开本地/线上网站，让用户看广告赚 token 积分
// 输出到 stderr，避免 stdout JSON schema 校验问题

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');

const HOME = os.homedir();
const CONFIG_PATHS = [
  path.join(HOME, '.zcode', 'v2', 'config.json'),
  path.join(HOME, '.zcode', 'cli', 'config.json'),
];
const HOOK_CONFIG_PATH = path.join(HOME, '.zcode', 'hooks', 'check-balance.config.json');

// 默认配置
const DEFAULT_CONFIG = {
  enabled: true,
  serverUrl: 'http://127.0.0.1:3099',
  thresholds: {
    'aiping.cn': 10,
    'api.qnaigc.com': 100,
  },
  // 用量阈值：24 小时用量超过多少 kToken 触发（七牛没有余额接口，用量预警）
  usageThresholds: {
    'api.qnaigc.com': 1000, // kToken
  },
  providerNames: {
    'aiping.cn': 'AIPing',
    'api.qnaigc.com': '七牛',
  },
};

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function writeJson(p, data) {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
  } catch {}
}

function loadConfig() {
  const existing = readJson(HOOK_CONFIG_PATH);
  if (!existing) {
    writeJson(HOOK_CONFIG_PATH, DEFAULT_CONFIG);
  }
  return { ...DEFAULT_CONFIG, ...(existing || {}) };
}

function readZcodeConfig() {
  for (const p of CONFIG_PATHS) {
    try {
      const raw = fs.readFileSync(p, 'utf-8');
      return JSON.parse(raw);
    } catch {}
  }
  return null;
}

function request(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method,
      headers,
      timeout: 3000,
    };
    const req = client.request(options, (res) => {
      let data = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    if (body) req.write(body);
    req.end();
  });
}

function isBalanceResponse(data) {
  if (data && (data.success === false || data.code >= 400 || data.error)) return false;
  const keys = Object.keys(data || {});
  return keys.some((k) => /balance|credit|available|amount|total|remain/i.test(k));
}

async function tryEndpoints(name, apiKey, endpoints, format) {
  for (const endpoint of endpoints) {
    try {
      const res = await request('GET', endpoint, {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      });
      if (res.status >= 200 && res.status < 300) {
        const data = JSON.parse(res.body);
        if (!isBalanceResponse(data)) continue;
        return { ok: true, message: format(data) };
      }
    } catch {}
  }
  return { ok: false, message: `${name}: 余额接口未返回有效数据` };
}

function formatOpenAIBalance(data) {
  if (data.total_available !== undefined) return `可用余额 ${data.total_available}`;
  if (data.balance !== undefined) return `余额 ${data.balance}`;
  if (data.credit !== undefined) return `额度 ${data.credit}`;
  if (data.total_used !== undefined) return `已用 ${data.total_used}`;
  return JSON.stringify(data);
}

async function checkAipingBalance(name, apiKey) {
  const endpoint = 'https://aiping.cn/api/v1/user/remain/points';
  try {
    const res = await request('GET', endpoint, {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    });
    if (res.status !== 200) {
      return { ok: false, message: `${name}: 余额查询失败 (HTTP ${res.status})` };
    }
    const data = JSON.parse(res.body);
    if (data.code !== 0) {
      return { ok: false, message: `${name}: ${data.msg || '查询失败'} (code ${data.code})` };
    }
    const d = data.data || {};
    const total = Number(d.total_remain ?? 0).toFixed(2);
    const recharge = Number(d.recharge_remain ?? 0).toFixed(2);
    const gift = Number(d.gift_remain ?? 0).toFixed(2);
    return {
      ok: true,
      balance: Number(total),
      message: `${name}: 总余额 ${total} 元（充值 ${recharge} + 赠送 ${gift}）`,
    };
  } catch (e) {
    return { ok: false, message: `${name}: 余额查询异常 (${e.message})` };
  }
}

function formatRFC3339(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, '+08:00');
}

async function checkQiniuUsage(name, apiKey) {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const start = formatRFC3339(yesterday);
  const end = formatRFC3339(now);
  const endpoint = `https://api.qnaigc.com/v3/stat/usage?granularity=day&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&timezone=Asia/Shanghai`;

  try {
    const res = await request('GET', endpoint, {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    });
    if (res.status !== 200) {
      return { ok: false, message: `${name}: 用量查询失败 (HTTP ${res.status})` };
    }
    const data = JSON.parse(res.body);
    if (!data.status) {
      return { ok: false, message: `${name}: ${data.error || '用量查询失败'}` };
    }

    const models = data.data || [];
    if (models.length === 0) {
      return { ok: true, message: `${name}: 最近 24 小时无用量记录` };
    }

    // 简单汇总总 token 用量
    let totalTokens = 0;
    models.forEach((m) => {
      (m.items || []).forEach((item) => {
        totalTokens += Number(item.total || 0);
      });
    });

    return { ok: true, usage: Number(totalTokens.toFixed(2)), message: `${name}: 最近 24 小时用量 ${totalTokens.toFixed(2)} kToken` };
  } catch (e) {
    return { ok: false, message: `${name}: 用量查询异常 (${e.message})` };
  }
}

async function healthCheck(name, baseURL, apiKey) {
  try {
    const res = await request('GET', `${baseURL.replace(/\/$/, '')}/v1/models`, {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    });
    if (res.status === 401) return { ok: false, message: `${name}: API Key 已失效/被吊销 (401)` };
    if (res.status >= 200 && res.status < 300) return { ok: true, message: `${name}: API Key 有效，但余额/用量接口未适配` };
    return { ok: false, message: `${name}: 健康检查失败 (HTTP ${res.status})` };
  } catch (e) {
    return { ok: false, message: `${name}: 网络异常，无法连接 (${e.message})` };
  }
}

async function checkProvider(id, provider, config) {
  const name = provider.name || id;
  const baseURL = (provider.options?.baseURL || '').replace(/\/$/, '');
  const apiKey = provider.options?.apiKey;

  if (provider.enabled === false) {
    return { ok: true, message: `${name}: provider 已禁用，跳过`, skip: true };
  }

  if (!baseURL || !apiKey) {
    return { ok: true, message: `${name}: 未配置 apiKey/baseURL，跳过`, skip: true };
  }

  const host = new URL(baseURL).hostname.toLowerCase();
  const threshold = config.thresholds[host];
  const usageThreshold = config.usageThresholds[host];

  const handlers = {
    'api.qnaigc.com': async () => {
      const result = await checkQiniuUsage(name, apiKey);
      if (result.ok && usageThreshold !== undefined && result.usage !== undefined && result.usage > usageThreshold) {
        result.alert = true;
        result.alertType = 'usage';
        result.threshold = usageThreshold;
      }
      return result;
    },
    'api.z.ai': () =>
      tryEndpoints(name, apiKey, [`${baseURL}/user/balance`, `${baseURL}/v1/user/balance`], formatOpenAIBalance),
    'open.bigmodel.cn': () =>
      tryEndpoints(name, apiKey, [`${baseURL}/user/balance`, `${baseURL}/v1/user/balance`], formatOpenAIBalance),
    'aiping.cn': async () => {
      const result = await checkAipingBalance(name, apiKey);
      if (result.ok && threshold !== undefined && result.balance !== null && result.balance <= threshold) {
        result.alert = true;
        result.alertType = 'balance';
        result.threshold = threshold;
      }
      return result;
    },
  };

  const result = handlers[host] ? await handlers[host]() : await healthCheck(name, baseURL, apiKey);

  if (!result.ok && !result.message.includes('余额接口')) {
    return result;
  }
  if (!result.ok) {
    const health = await healthCheck(name, baseURL, apiKey);
    return { ok: health.ok, message: `${result.message}；${health.message}` };
  }
  return result;
}

function getMachineId() {
  const info = [os.hostname(), os.userInfo().username, os.platform()].join('|');
  return require('node:crypto').createHash('sha256').update(info).digest('hex').slice(0, 16);
}

async function isSnoozed(config, userId, providerHost) {
  try {
    const url = `${config.serverUrl}/api/snooze-check?user=${encodeURIComponent(userId)}&provider=${encodeURIComponent(providerHost)}`;
    const res = await request('GET', url, { Accept: 'application/json' });
    if (res.status >= 200 && res.status < 300) {
      const data = JSON.parse(res.body);
      return data.snoozed === true;
    }
  } catch {}
  return false;
}

function openBrowser(url) {
  const platform = os.platform();
  let cmd;
  if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  try {
    exec(cmd);
  } catch (e) {
    console.error(`[check-balance] 打开浏览器失败: ${e.message}`);
  }
}

function writeMarker(message) {
  const markerPath = path.join(os.homedir(), '.zcode', 'hooks', 'check-balance.marker.log');
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    fs.appendFileSync(markerPath, line);
  } catch {}
}

async function main() {
  writeMarker('脚本被调用');

  const config = loadConfig();
  if (!config.enabled) {
    console.error('[check-balance] hook 已禁用');
    return;
  }

  const zcodeConfig = readZcodeConfig();
  if (!zcodeConfig || !zcodeConfig.provider) {
    console.error('[check-balance] 未能读取 ZCode provider 配置');
    writeMarker('失败：未读取到 provider 配置');
    return;
  }

  const entries = Object.entries(zcodeConfig.provider).filter(
    ([, p]) => p.source === 'custom' && p.options?.baseURL && p.options?.apiKey
  );

  if (entries.length === 0) {
    console.error('[check-balance] 未找到有效的自定义 provider');
    return;
  }

  console.error('[check-balance] 开始检查模型 provider 余额...');
  const userId = getMachineId();

  for (const [id, provider] of entries) {
    const result = await checkProvider(id, provider, config);
    const prefix = result.ok ? '✅' : '⚠️';
    console.error(`${prefix} ${result.message}`);

    if (result.ok && result.alert) {
      const host = new URL((provider.options.baseURL || '').replace(/\/$/, '')).hostname.toLowerCase();
      const snoozed = await isSnoozed(config, userId, host);
      if (snoozed) {
        console.error(`⏰ ${config.providerNames[host] || host} 已被用户设置 snooze，跳过弹窗`);
        continue;
      }

      const type = result.alertType || 'balance';
      const rawValue = type === 'usage' ? result.usage : (result.balance ?? '未知');
      const value = typeof rawValue === 'number' ? rawValue.toFixed(2) : String(rawValue);
      const rawThreshold = result.threshold ?? config.thresholds[host] ?? config.usageThresholds[host] ?? '未知';
      const threshold = typeof rawThreshold === 'number' ? rawThreshold.toFixed(2) : String(rawThreshold);
      const name = config.providerNames[host] || host;

      const warnUrl = `${config.serverUrl}/warn.html?provider=${encodeURIComponent(host)}&name=${encodeURIComponent(name)}&balance=${encodeURIComponent(value)}&threshold=${encodeURIComponent(threshold)}&user=${encodeURIComponent(userId)}&type=${type}`;
      console.error(`🔔 ${name} 余额/用量低，打开广告页面: ${warnUrl}`);
      openBrowser(warnUrl);
    }
  }
}

main().catch((e) => {
  console.error(`[check-balance] 检查失败: ${e.message}`);
  writeMarker(`异常: ${e.message}`);
});
