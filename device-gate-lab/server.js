/**
 * Device Gate Lab —— 设备指纹网关 / 前端凭据 / WebSocket 协议 三关靶场
 *
 * 纯 Node 原生模块，零依赖。
 * 启动: node server.js   或   npm start
 * 访问: http://127.0.0.1:8080/
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8080;
const PUBLIC = path.join(__dirname, 'public');

// ── 靶场凭据 ───────────────────────────────────────────────
const API_KEY = 'lab_7f3a9c2e51b84d6a90c1e35d';

// ── 三个 flag ─────────────────────────────────────────────
const FLAG1 = 'FLAG{stage1_device_gateway_bypassed}';
const FLAG2 = 'FLAG{stage2_ws_subprotocol_wa_v1}';
const FLAG3 = 'FLAG{stage3_frontend_api_key_recovered}';

// ── 服务端设备判定（真实站点 WAF 也看这个）──────────────────
const MOBILE_UA = /android|iphone|ipod|ipad|mobile|harmonyos|micromessenger/i;

// ── 工具函数 ──────────────────────────────────────────────
function send(res, status, type, body, extra) {
  const headers = { 'content-type': type, 'cache-control': 'no-store', server: 'nginx', 'x-cache': 'BYPASS' };
  if (extra) Object.assign(headers, extra);
  res.writeHead(status, headers);
  res.end(body);
}
const json = (res, status, obj, extra) => send(res, status, 'application/json; charset=utf-8', JSON.stringify(obj), extra);

function notFound(res) {
  send(res, 404, 'text/html; charset=utf-8', `<!DOCTYPE html>
<html lang="en"><head><title>404 Not Found</title>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<style>address{line-height:1.8}</style></head>
<body><h1>404 Not Found</h1><p><!-- 内容 --></p>
<address>Connection: 127.0.0.1 (Client) -&gt;  (Server)</address>
<address>Request ID: ${Date.now()}${Math.floor(Math.random() * 1000)}</address>
</body></html>`);
}

function serveFile(res, file, type) {
  const p = path.join(PUBLIC, file);
  fs.readFile(p, (err, data) => {
    if (err) return notFound(res);
    send(res, 200, type, data);
  });
}

// ── WebSocket 最小实现 ─────────────────────────────────────
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function wsAccept(key) {
  return crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
}

function wsFrame(opcode, payload) {
  const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
  const len = buf.length;
  let head;
  if (len < 126) {
    head = Buffer.alloc(2);
    head[1] = len;
  } else if (len < 65536) {
    head = Buffer.alloc(4);
    head[1] = 126;
    head.writeUInt16BE(len, 2);
  } else {
    head = Buffer.alloc(10);
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(len), 2);
  }
  head[0] = 0x80 | opcode;
  return Buffer.concat([head, buf]);
}

function wsSendText(socket, text) {
  try { socket.write(wsFrame(0x1, text)); } catch (e) {}
}

function wsClose(socket, code, reason) {
  const r = Buffer.from(reason || '', 'utf8');
  const payload = Buffer.alloc(2 + r.length);
  payload.writeUInt16BE(code, 0);
  r.copy(payload, 2);
  try { socket.write(wsFrame(0x8, payload)); } catch (e) {}
  setTimeout(() => { try { socket.destroy(); } catch (e) {} }, 50);
}

/** 解析客户端帧（客户端帧必带 mask） */
function wsParse(buf) {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) === 0x80;
  let len = buf[1] & 0x7f;
  let off = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; }
  else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); off = 10; }
  let mask = null;
  if (masked) { if (buf.length < off + 4) return null; mask = buf.slice(off, off + 4); off += 4; }
  if (buf.length < off + len) return null;
  let payload = buf.slice(off, off + len);
  if (masked) { payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4]; }
  return { opcode, payload };
}

function wsEnvelope(type, extra) {
  return JSON.stringify(Object.assign({
    v: 1,
    type,
    event_id: 'evt_' + crypto.randomBytes(8).toString('hex'),
    request_id: null,
    session_id: null,
    seq: 0,
    sent_at: new Date().toISOString()
  }, extra || {}));
}

function wsError(socket, reqId, code, message) {
  wsSendText(socket, wsEnvelope('error', {
    request_id: reqId || null,
    payload: { error: { code, message, retryable: false } }
  }));
}

// ── HTTP 服务 ─────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  const ua = req.headers['user-agent'] || '';

  // 根路径：故意 404
  if (url === '/') return notFound(res);

  // SPA 外壳（所有 /static/** 都 fallback 到这里）
  if (url === '/static/' || url.startsWith('/static/')) {
    return serveFile(res, 'static.html', 'text/html; charset=utf-8');
  }

  // 静态资源
  if (url === '/kv5Mjg/mgate.js') return serveFile(res, 'mgate.js', 'application/javascript; charset=utf-8');
  if (url === '/kv5Mjg/app.js') return serveFile(res, 'app.js', 'application/javascript; charset=utf-8');
  if (url === '/favicon.ico') return send(res, 200, 'image/x-icon', '');

  // ── 第 1 关：分配接口（服务端校验 UA，模拟真实 WAF）──
  if (url === '/api/allocate') {
    if (!MOBILE_UA.test(ua)) {
      return json(res, 403, { success: false, message: 'device not allowed' });
    }
    return json(res, 200, {
      success: true,
      data: {
        assigned_interface: 1 + Math.floor(Math.random() * 5),
        client_id: crypto.randomBytes(16).toString('hex'),
        code: 'hk',
        callingCode: 'hk',
        ipCountry: 'CN',
        verify: true,
        web: 2,
        by: 0,
        cs_mode: 'native',
        flag: FLAG1
      },
      message: 'Interface allocation successful'
    });
  }

  // ── 第 3 关：需要 X-Api-Key ──────────────────────────
  if (url === '/api/tg-cs/session/health') {
    const key = req.headers['x-api-key'];
    if (!key) return json(res, 200, { code: 400, message: '访问未授权' });
    if (key !== API_KEY) return json(res, 200, { code: 400, message: '访问未授权' });
    return json(res, 200, {
      code: 200,
      message: 'success',
      data: { reachable: true, time: new Date().toISOString(), flag: FLAG3 }
    });
  }

  // ── 其他 API 一律走框架兜底 ──────────────────────────
  if (url.startsWith('/api/')) {
    if (url === '/api/interact') return json(res, 200, { success: true, data: { mode: 'page' } });
    return json(res, 200, { code: 404, msg: '404 Not Found', data: [] });
  }

  return notFound(res);
});

// ── WebSocket 升级（第 2 关）──────────────────────────────
server.on('upgrade', (req, socket) => {
  const m = /^\/api\/v1\/ws([1-9]\d*)$/.exec(req.url || '');
  if (!m) { socket.destroy(); return; }
  const n = Number(m[1]);
  if (n > 4) { socket.destroy(); return; }          // 只有 ws1-ws4

  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }

  const protos = (req.headers['sec-websocket-protocol'] || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  let res = 'HTTP/1.1 101 Switching Protocols\r\n' +
            'Upgrade: websocket\r\n' +
            'Connection: Upgrade\r\n' +
            'Sec-WebSocket-Accept: ' + wsAccept(key) + '\r\n';

  // 没带 wa.v1：先握手成功，再 close 4002（复刻真实行为）
  if (!protos.includes('wa.v1')) {
    socket.write(res + '\r\n');
    setTimeout(() => wsClose(socket, 4002, 'wa.v1 required'), 120);
    return;
  }

  res += 'Sec-WebSocket-Protocol: wa.v1\r\n\r\n';
  socket.write(res);

  let buf = Buffer.alloc(0);
  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    let frame;
    while ((frame = wsParse(buf))) {
      buf = buf.slice(0);   // 简化处理：一次性消费
      buf = Buffer.alloc(0);

      if (frame.opcode === 0x8) { try { socket.destroy(); } catch (e) {} return; }
      if (frame.opcode !== 0x1) continue;

      let msg;
      try { msg = JSON.parse(frame.payload.toString('utf8')); }
      catch (e) { wsError(socket, null, 'VALIDATION_ERROR', 'invalid websocket command'); return; }

      if (!msg || typeof msg !== 'object') {
        wsError(socket, null, 'VALIDATION_ERROR', 'invalid websocket command'); return;
      }
      if (!msg.type) {
        wsError(socket, msg.request_id, 'VALIDATION_ERROR', 'invalid websocket command'); return;
      }
      // 命令白名单：只有 session.poll 注册过
      if (msg.type !== 'session.poll') {
        wsError(socket, msg.request_id, 'VALIDATION_ERROR', 'unknown command type'); return;
      }
      if (!msg.session_id) {
        wsError(socket, msg.request_id, 'VALIDATION_ERROR', 'session_id is required'); return;
      }

      // 通关
      wsSendText(socket, wsEnvelope('result', {
        request_id: msg.request_id || null,
        session_id: msg.session_id,
        payload: {
          messages: [],
          flag: FLAG2,
          hint: '子协议 + 信封 + 命令名，三样都对才会走到这里'
        }
      }));
    }
  });

  socket.on('error', () => { try { socket.destroy(); } catch (e) {} });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  靶场已启动  http://127.0.0.1:' + PORT + '/');
  console.log('');
  console.log('  根路径是 404 —— 这是故意的，真正的入口自己找。');
  console.log('  任务卡: README.md');
  console.log('');
  console.log('  API_KEY (答案，别偷看): ' + API_KEY);
  console.log('');
});
