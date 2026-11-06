/* =====================================================================
 * 擂台赛专属播报语料 XKA
 * 与 XKP 的分工：单题答对/答错仍用 XKP（学习反馈口径两个模式必须一致）；
 * 这里只管擂台事件——开场、守擂成功、擂主被换、挑战者落败、最终结算。
 * 占位符：{c}=擂主名，{h}=挑战者名，{n}=连胜场数
 * ===================================================================== */
(function (root) {
  'use strict';

  /* 第一场：台上还没有擂主，先定擂主 */
  var FIRST = [
    '第一场上擂台，{c}对{h}。这一场赢的人，就是今天的第一个擂主！',
    '擂台刚支起来，{c}和{h}先来定擂主。谁赢谁坐上去。',
    '开台第一战：{c}对{h}。擂主之位，就看这一场。',
    '{c}、{h}两人先打头阵，胜者坐上擂台，其余同学排队等着踢馆。'
  ];

  /* 每场开场：已有擂主，报挑战者 */
  var OPEN = [
    '现在打擂台。擂主{c}，已连胜{n}场。挑战者{h}，上台！',
    '擂主{c}守台{n}场，{h}来踢馆。两位各答各的题，赢的留下。',
    '{h}走上擂台，向守擂{n}场的{c}挑战。开始！',
    '第{n}场守擂：{c}坐台，{h}上台。谁答得又快又准，谁留在台上。',
    '擂台挑战开始：{c}对{h}。{c}要守住，{h}要抢下。',
    '{h}要撼动已经连胜{n}场的{c}。历史上这种挑战，多半守得住——来试试。'
  ];

  /* 擂主守住 */
  var HOLD = [
    '{c}守住了！这是第{n}场连赢，擂台还没人撼得动。',
    '又是{c}！连胜{n}场，挑战者一个都没拿下擂台。',
    '{c}稳稳守住，连胜涨到{n}场。这位同学今天状态在线。',
    '擂主还是{c}，{n}场连赢。台下还有谁想试？',
    '{c}又一次站到最后，连胜{n}场。这手感，是刷了多少题换来的。',
    '守住咯！{c}把第{n}场胜利收入囊中。',
    '{c}连守{n}场，擂台上的位置越来越稳。',
    '第{n}次守擂成功，{c}这道墙还挺硬。',
    '{c}又赢了，{n}场连赢。挑战者们别灰心，接着上。',
    '{n}场连赢！{c}现在全班都知道你厉害了。'
  ];

  /* 擂主被换（挑战者抢下擂台） */
  var OUST = [
    '擂台换主人！{h}把{c}请下了台，新擂主诞生。',
    '{h}赢了！{c}的连胜到此为止，现在擂主是{h}。',
    '爆冷了！{h}掀翻擂主{c}，坐上擂台。',
    '{h}抢下擂台，{c}守擂结束。下一位挑战者，准备。',
    '新擂主{h}！从{c}手里接过来的，位置烫手，看你能守几场。',
    '{c}守到头了，{h}成为新擂主。这就是擂台的魅力。',
    '{h}把擂主之位夺走，{c}回座位复盘去。{h}，接下来轮到你守。',
    '擂台易主：{h}胜出，{c}下台。掌声给两位。'
  ];

  /* 挑战者落败（回座位） */
  var FALL = [
    '{h}差一口气。回去练两手，下一场再来。',
    '这一场{h}没抢下擂台。别灰心，能上台就已经赢了胆量。',
    '{h}下台。错题本里看一眼刚才错在哪，下次更稳。',
    '{h}没能撼动擂主。不过敢上擂台的同学，本身就值得表扬。',
    '{h}这场输了，但答对的题也不少。回去补补，再来踢馆。',
    '挑战失败，{h}回座位。擂台还在，机会还有。'
  ];

  /* 本场擂台结束（满 N 场结算） */
  var FINAL = [
    '本场擂台结束，{c}守住{n}场，是本节课的擂主！',
    '擂台收摊。最终擂主{c}，连胜{n}场，全班最稳的就是你。',
    '今天打到这里，擂主是{c}，守了{n}场。其他同学下次再战。',
    '结算完成：{c}以{n}场连胜坐上最终擂主之位，掌声送上！',
    '本场擂台的擂主——{c}，连胜{n}场。这份手感，明天继续保持。',
    '收台！{c}守住{n}场成为擂主，没上过台的同学下节课优先安排。'
  ];

  function fill(tpl, map) {
    return tpl.replace(/\{([chn])\}/g, function (m, k) { return map[k] == null ? '' : String(map[k]); });
  }
  function pick(arr, map) {
    return fill(arr[Math.floor(Math.random() * arr.length)], map);
  }

  var XKA = {
    first: function (c, h) { return pick(FIRST, { c: c, h: h }); },
    open: function (c, h, n) { return pick(OPEN, { c: c, h: h, n: n }); },
    hold: function (c, n) { return pick(HOLD, { c: c, h: c, n: n }); },
    oust: function (c, h) { return pick(OUST, { c: c, h: h }); },
    fall: function (h) { return pick(FALL, { c: h, h: h }); },
    final: function (c, n) { return pick(FINAL, { c: c, h: c, n: n }); },
    count: function () { return FIRST.length + OPEN.length + HOLD.length + OUST.length + FALL.length + FINAL.length; },
    pools: function () { return { first: FIRST, open: OPEN, hold: HOLD, oust: OUST, fall: FALL, final: FINAL }; },
    allTemplates: function () { return [].concat(FIRST, OPEN, HOLD, OUST, FALL, FINAL); }
  };

  root.XKA = XKA;
})(typeof window !== 'undefined' ? window : globalThis);
