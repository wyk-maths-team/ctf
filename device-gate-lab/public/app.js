/**
 * app.js —— 业务逻辑（靶场版）
 *
 * 这里藏着第 3 关的答案：一个硬编码的 API 密钥。
 * 真实站点里它也在类似的位置。
 */
(function () {
  'use strict';

  // ⚠️ 这就是第 3 关要你找的东西
  var API_KEY = 'lab_7f3a9c2e51b84d6a90c1e35d';

  var logEl = document.getElementById('log');
  function log(s) {
    if (logEl) logEl.textContent += '\n> ' + s;
    console.log('[app] ' + s);
  }

  // ─────────────────────────────────────────────
  // 第 1 关：调分配接口，拿 FLAG1
  // 注意：这个接口服务端也会检查 User-Agent，光改 navigator 不够
  // ─────────────────────────────────────────────
  fetch('/api/allocate')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d && d.success) {
        var slot = document.getElementById('flag1-slot');
        if (slot) {
          slot.innerHTML = '<div class="flag">🎉 第 1 关通关<br>' + d.data.flag + '</div>';
        }
        var gb = document.getElementById('gate-bubble');
        if (gb) {
          gb.innerHTML = '✅ 裝置驗證通過<div class="t">interface=' + d.data.assigned_interface + '</div>';
        }
        log('allocate ok — interface=' + d.data.assigned_interface + ', client_id=' + d.data.client_id.slice(0, 8) + '…');
      } else {
        log('allocate 被拒: ' + (d && d.message));
      }
    })
    .catch(function (e) { log('allocate 出错: ' + e.message); });

  // ─────────────────────────────────────────────
  // 第 3 关线索：页面自己带着 key 调 tg-cs
  // 去 Network 面板看这条请求的 Request Headers
  // ─────────────────────────────────────────────
  fetch('/api/tg-cs/session/health', {
    headers: { 'X-Api-Key': API_KEY, accept: 'application/json' }
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      // 注意：这里只打印 code，不打印 flag。
      // 想拿 flag，你得自己用这个 key 去请求一次。
      log('tg-cs/session/health → code=' + d.code);
      if (d.code === 200 && d.data) {
        log('（服务器返回了额外字段，但我没打印出来 —— 自己去看响应体）');
      }
    })
    .catch(function (e) { log('tg-cs 出错: ' + e.message); });

  // ─────────────────────────────────────────────
  // 第 2 关线索：WebSocket
  // 页面连一次，故意不带子协议 —— 看服务器怎么骂你
  // ─────────────────────────────────────────────
  function connectWS(protocols) {
    var url = 'ws://' + location.host + '/api/v1/ws1';
    var ws = protocols ? new WebSocket(url, protocols) : new WebSocket(url);
    ws.onopen = function () { log('ws OPEN, protocol=' + (ws.protocol || '(none)')); };
    ws.onmessage = function (e) { log('ws MSG: ' + e.data); };
    ws.onclose = function (e) { log('ws CLOSE ' + e.code + ' ' + (e.reason || '(no reason)')); };
    ws.onerror = function () { log('ws ERROR'); };
    return ws;
  }
  window.__connectWS = connectWS;

  setTimeout(function () { connectWS(null); }, 900);

  // ─────────────────────────────────────────────
  // 帧构造器（复刻真实站点的 Kf 函数）
  // 想看协议格式的话，从这里读
  // ─────────────────────────────────────────────
  window.__buildFrame = function (type, payload, sessionId) {
    return JSON.stringify({
      v: 1,
      type: type,
      request_id: 'req_' + Math.random().toString(36).slice(2, 14),
      session_id: sessionId || null,
      sent_at: new Date().toISOString(),
      payload: payload || {}
    });
  };

  // 靶场用的假提交
  window.fakeSubmit = function () {
    var v = document.getElementById('phone');
    log('提交号码: ' + (v ? v.value : '(空)') + ' —— 靶场不发送任何请求');
  };

  log('app.js loaded — API_KEY 就在这个文件里');
})();
