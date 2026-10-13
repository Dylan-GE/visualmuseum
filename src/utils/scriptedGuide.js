import { getItemTypeLabel } from './itemTheme';

// 測試用的「死」問答：還沒有串接真正的 AI 之前，用預先寫好的規則回答。
// 內容只取自博物館自己的資料（展品的用途／外觀／歷史、區域名稱）和操作說明，
// 不憑空編造歷史；角色只決定口吻（開頭與收尾），事實都一樣。

const hasText = (v) => typeof v === 'string' && v.trim() !== '' && !/待確認|待補/.test(v);

// 資料裡有些備註寫在括號裡（例如「與雷管箱可能共用同一箱體模型」），那是給我們自己看的，不給訪客。
const clean = (v) =>
  hasText(v)
    ? v
        .replace(/[（(][^）)]*(模型|共用|待確認|暫)[^）)]*[）)]?/g, '')
        .replace(/[，,。；;\s]+$/g, '')
        .trim()
    : '';

const VOICE = {
  miner: {
    open: ['少年仔，', '嗯，這個我知道。'],
    close: ['有想看哪一樣，就走過去點它。', '坑裡的東西，一樣一樣看。'],
    unknown: '這個老歐吉桑答不出來啦，我只會講坑道裡這些東西。',
  },
  geologist: {
    open: ['您好，', '簡單整理一下：'],
    close: ['如果想了解特定展品，直接告訴我名稱即可。', '需要的話，也可以再問我其他展品。'],
    unknown: '這個問題超出我目前能回答的範圍，我可以說明坑道裡的機具與設施。',
  },
  goldRush: {
    open: ['夥計，', '嘿！'],
    close: ['走，到坑裡親眼看看！', '想知道更多，儘管再問！'],
    unknown: '這個我可答不上來，不過坑道裡的家當我都熟！',
  },
};

// 每個角色都有的建議問題（點了就送出）
export const SUGGESTED_QUESTIONS = [
  '這裡是什麼地方？',
  '有哪些展品可以看？',
  '支撐設施是做什麼的？',
  '我現在這一區有什麼？',
  '怎麼收集圖鑑？',
];

const pick = (list, seed) => list[seed % list.length];
const seedOf = (text) => [...text].reduce((n, c) => n + c.charCodeAt(0), 0);

function wrap(persona, body, text) {
  const v = VOICE[persona] ?? VOICE.miner;
  const seed = seedOf(text);
  return `${pick(v.open, seed)}${body}`;
}

function wrapEnd(persona, body, text) {
  const v = VOICE[persona] ?? VOICE.miner;
  return `${wrap(persona, body, text)}${pick(v.close, seedOf(text) + 1)}`;
}

function itemAnswer(item) {
  const parts = [];
  const fn = clean(item.spec?.function);
  const look = clean(item.spec?.appearance);
  const story = clean(item.history?.mining_story || item.history?.use_value);
  if (fn) parts.push(`「${item.name}」：${fn}。`);
  if (look) parts.push(`外觀上，${look}。`);
  if (story) parts.push(story.endsWith('。') ? story : `${story}。`);
  if (!parts.length) parts.push(`「${item.name}」是坑道裡的${getItemTypeLabel(item.type)}，詳細資料可以點它旁邊的標記查看。`);
  return parts.slice(0, 2).join('');
}

const TYPE_KEYWORDS = [
  ['transport', ['搬運', '運輸', '礦車', '輸送', '台車', '機車']],
  ['tool', ['開採', '工具', '鑿岩', '採煤', '爆破', '炸藥', '雷管']],
  ['support', ['支撐', '支架', '坑木', '圓拱', '撐']],
  ['ventilation', ['通風', '風扇', '風門', '空氣']],
  ['drainage', ['排水', '抽水']],
  ['electrical', ['機電', '電力', '捲揚', '絞車', '呼吸器']],
];

function typeAnswer(type, items) {
  const list = items.filter((i) => i.type === type);
  if (!list.length) return null;
  const names = list.slice(0, 8).map((i) => i.name).join('、');
  const more = list.length > 8 ? `等 ${list.length} 項` : `共 ${list.length} 項`;
  return `博物館的${getItemTypeLabel(type)}有：${names}（${more}）。想知道哪一樣，直接問我它的名字。`;
}

// 簡單的名稱比對：問句裡含有展品全名，或展品名稱去掉常見字尾後的核心字出現在問句裡
function findItem(text, items) {
  const exact = items
    .filter((i) => text.includes(i.name))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (exact) return exact;
  return items.find((i) => {
    const core = i.name.replace(/(支撐|機車頭|機|箱|袋|器|斧頭|鋸|鏟|錘)$/g, '');
    return core.length >= 2 && text.includes(core);
  });
}

// context: { items, zones, currentZone }
export function scriptedReply(persona, rawText, context = {}) {
  const text = rawText.replace(/\s+/g, '');
  const items = context.items ?? [];
  const zone = context.currentZone;
  const v = VOICE[persona] ?? VOICE.miner;

  // 1. 問到某個具體展品
  const item = findItem(text, items);
  if (item) return wrapEnd(persona, itemAnswer(item), text);

  // 2. 目前在哪一區
  if (/(這一區|這區|現在|目前|位置|在哪)/.test(text) && /(有什麼|有哪些|展品|位置|哪裡|哪)/.test(text) && zone) {
    const here = items.filter((i) => i.zone_id === zone.id);
    if (here.length) {
      const names = here.slice(0, 6).map((i) => i.name).join('、');
      return wrapEnd(persona, `你現在在「${zone.name}」，這一區放了 ${here.length} 件展品，像是${names}${here.length > 6 ? ' 等' : ''}。`, text);
    }
    return wrapEnd(persona, `你現在在「${zone.name}」，這一區沒有放展品，往旁邊的坑道走走看。`, text);
  }

  // 3. 這是什麼地方
  if (/(哪裡|什麼地方|是哪|瑞三|猴硐|介紹|簡介|這座)/.test(text)) {
    return wrapEnd(
      persona,
      '這裡是臺灣虛擬礦業博物館，場景是新北市瑞芳猴硐的歷史煤礦坑「瑞三本鑛」的坑道。博物館展出的是坑道裡的機具與設施，你可以沿著坑道走，點開每一件展品看它的用途和故事。',
      text,
    );
  }

  // 4. 有哪些展品
  if (/(展品|有什麼|有哪些|可以看|看什麼|總共)/.test(text)) {
    const byType = {};
    for (const i of items) byType[i.type] = (byType[i.type] ?? 0) + 1;
    const summary = Object.entries(byType)
      .map(([t, n]) => `${getItemTypeLabel(t)} ${n} 件`)
      .join('、');
    return wrapEnd(persona, `目前有 ${items.length} 件展品：${summary}。想了解哪一類，可以直接問，例如「支撐設施是做什麼的？」`, text);
  }

  // 5. 某一類展品
  for (const [type, words] of TYPE_KEYWORDS) {
    if (words.some((w) => text.includes(w))) {
      const answer = typeAnswer(type, items);
      if (answer) return wrapEnd(persona, answer, text);
    }
  }

  // 6. 圖鑑／玩法
  if (/(圖鑑|收集|收藏|答題|遊戲|解鎖|怎麼玩)/.test(text)) {
    return wrapEnd(
      persona,
      '點開一件展品，按右下角的「遊戲收藏」，答對問題就能把它收進「我的圖鑑」。收集進度會顯示在右下角的場景卡上。',
      text,
    );
  }

  // 7. 操作
  if (/(操作|怎麼走|怎麼移動|移動|前進|控制|滑鼠|導覽)/.test(text)) {
    return wrapEnd(
      persona,
      '用滑鼠拖曳可以環顧四周，滾輪拉近拉遠；點地面上的光點箭頭就會往前走；點坑道裡的設備可以看詳細資料。左下角的小地圖和右下角的「場景列表」可以快速跳到別的區域。',
      text,
    );
  }

  // 8. AR
  if (/(AR|擴增|QR|手機|掃描|實物)/i.test(text)) {
    return wrapEnd(
      persona,
      '打開展品的詳細資料，會看到一個 QR Code。用手機掃描它，就能在自己的空間裡以 1:1 的實物大小看這件展品的 3D 模型，可以走動、繞著它看。',
      text,
    );
  }

  // 9. 角色自我介紹
  if (/(你是誰|你是|自我介紹|名字)/.test(text)) {
    const who = { miner: '老礦工', geologist: '地質學家', goldRush: '淘金客' }[persona] ?? '導覽夥伴';
    return wrapEnd(persona, `我是${who}，在這座博物館裡陪你逛坑道、回答展品的問題。`, text);
  }

  // 10. 問候
  if (/^(你好|哈囉|嗨|hi|hello|早安|午安|晚安)/i.test(text)) {
    return wrapEnd(persona, '歡迎來到瑞三本鑛！想看什麼，儘管問我。', text);
  }

  return `${v.unknown}目前是測試版，只能回答預先準備好的問題，可以試試下面的建議問題。`;
}
