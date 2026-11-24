/**
 * mgate.js —— 设备指纹网关（靶场版）
 *
 * 逻辑和真实站点一致，但没做混淆，方便你读懂它。
 * 真实站点里这个文件也是明文的 —— 这是他们的失误，也是你的机会。
 *
 * 返回 false = 拦截（页面白屏）
 * 返回 true  = 放行（页面显示）
 */
(function () {
  'use strict';

  // ① 爬虫 / 自动化工具黑名单
  var BOT = /(?:^|[^a-z0-9])(?:googlebot|bingbot|baiduspider|yandexbot|bytespider|petalbot|gptbot|claudebot|ccbot|headlesschrome|phantomjs|selenium|puppeteer|playwright|python-requests|node-fetch|curl|wget|postman)(?:[^a-z0-9]|$)/i;

  // ② 移动端 UA 关键词
  var MOBILE = /android|iphone|ipod|ipad|mobile|harmonyos|micromessenger/i;

  // ③ 桌面操作系统
  var DESKTOP_PLATFORM = /win32|win64|macintel|cros|wow64/i;

  // ④ 桌面显卡（这段是重点）
  var DESKTOP_GPU = /geforce|quadro|radeon|nvidia|direct3d|d3d11|d3d12|microsoft basic render|intel\(r\)|intel iris|intel uhd|intel hd graphics|amd radeon|swiftshader/i;

  function isTablet() {
    if ((Number(navigator.maxTouchPoints) || 0) <= 1) return false;
    var ua = String(navigator.userAgent || '').toLowerCase();
    if (/android|windows/.test(ua)) return false;
    var p = String(navigator.platform || '').toLowerCase();
    return p === 'macintel' && /macintosh|ipad/.test(ua) && !/iphone|ipod/.test(ua);
  }

  function gpuRenderer() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return '';
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (!ext) return '';
      return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
    } catch (e) {
      return '';
    }
  }

  function check() {
    var ua = String(navigator.userAgent || '').toLowerCase();
    var platform = String(navigator.platform || '').toLowerCase();

    // 爬虫 → 拦
    if (BOT.test(ua)) {
      console.log('[mgate] blocked: bot UA');
      return false;
    }

    // 既不是移动 UA，也不是平板 → 拦
    if (!MOBILE.test(ua) && !isTablet()) {
      console.log('[mgate] blocked: not mobile');
      return false;
    }

    // 桌面操作系统 → 拦（平板豁免）
    if (DESKTOP_PLATFORM.test(platform) && !isTablet()) {
      console.log('[mgate] blocked: desktop platform (' + navigator.platform + ')');
      return false;
    }

    // 桌面显卡 → 拦
    var gpu = gpuRenderer();
    if (DESKTOP_GPU.test(gpu)) {
      console.log('[mgate] blocked: desktop GPU (' + gpu.slice(0, 60) + ')');
      return false;
    }

    // UA-CH 说自己在桌面 → 拦
    var uad = navigator.userAgentData;
    if (uad && uad.mobile === false) {
      var p2 = String(uad.platform || '').toLowerCase();
      if (/windows|macos|mac os|chrome os/.test(p2)) {
        console.log('[mgate] blocked: UA-CH desktop');
        return false;
      }
    }

    return true;
  }

  var passed = check();
  window.__gatePassed = passed;

  if (passed) {
    document.documentElement.classList.add('wa-ok');
    console.log('[mgate] PASSED — wa-ok added');
  } else {
    document.documentElement.setAttribute('data-wa-block', '1');
    console.log('[mgate] BLOCKED — data-wa-block set, body hidden');
  }
})();
