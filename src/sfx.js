/* =====================================================================
 * 学考冲刺通 · 音效引擎（Web Audio 现场合成，零音频文件，保持单文件交付）
 * 开关存 localStorage('xkc.sfx')；移动端需用户手势后 resume。
 * ===================================================================== */
(function (root) {
  'use strict';
  var ctx = null, enabledCache = null;

  function isEnabled() {
    if (enabledCache === null) {
      try { enabledCache = root.localStorage ? root.localStorage.getItem('xkc.sfx') !== '0' : true; }
      catch (e) { enabledCache = true; }
    }
    return enabledCache;
  }
  function setEnabled(v) {
    enabledCache = !!v;
    try { root.localStorage.setItem('xkc.sfx', v ? '1' : '0'); } catch (e) { }
  }

  function ac() {
    if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') return null;
    if (!ctx) { try { ctx = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { } }
    return ctx;
  }

  function tone(freq, start, dur, type, vol) {
    var c = ac(); if (!c) return;
    try {
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'triangle';
      o.frequency.setValueAtTime(freq, c.currentTime + start);
      g.gain.setValueAtTime(0.0001, c.currentTime + start);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, c.currentTime + start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
      o.connect(g); g.connect(c.destination);
      o.start(c.currentTime + start);
      o.stop(c.currentTime + start + dur + 0.05);
    } catch (e) { }
  }

  var SFX = {
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    // 首次用户手势解锁（设置页任意点击时调一次）
    unlock: function () { ac(); },
    // 答对：上行琶音（C-E-G-C5）
    correct: function () {
      if (!isEnabled()) return;
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
        tone(f, i * 0.085, 0.18, 'triangle', 0.2);
      });
    },
    // 答错：温和双音下行（不刺耳）
    wrong: function () {
      if (!isEnabled()) return;
      tone(311.13, 0, 0.16, 'sine', 0.15);
      tone(233.08, 0.15, 0.26, 'sine', 0.14);
    },
    // 点名滚动：极轻 tick
    tick: function () {
      if (!isEnabled()) return;
      tone(880, 0, 0.03, 'square', 0.045);
    },
    // 点名定格 / 表扬登场：小号式号角
    fanfare: function () {
      if (!isEnabled()) return;
      [392, 523.25, 659.25, 783.99].forEach(function (f, i) {
        tone(f, i * 0.11, 0.3, 'triangle', 0.18);
      });
      tone(1046.5, 0.46, 0.55, 'triangle', 0.2);
    },
    // 按钮轻点音
    click: function () {
      if (!isEnabled()) return;
      tone(660, 0, 0.05, 'sine', 0.08);
    },
    // 擂台开场：低频两下 + 高音一下（鼓点，与双人 PK 的上行三音明显不同）
    drum: function () {
      if (!isEnabled()) return;
      tone(110, 0, 0.16, 'sine', 0.3);
      tone(110, 0.2, 0.16, 'sine', 0.3);
      tone(440, 0.42, 0.34, 'triangle', 0.2);
    },
    // 擂台易主：下行两音（擂主被换下的信号）
    oust: function () {
      if (!isEnabled()) return;
      tone(523.25, 0, 0.2, 'triangle', 0.2);
      tone(392, 0.18, 0.24, 'triangle', 0.2);
      tone(293.66, 0.4, 0.4, 'triangle', 0.22);
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SFX;
  root.XKS = SFX;
})(typeof window !== 'undefined' ? window : globalThis);
