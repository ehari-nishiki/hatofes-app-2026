// ユーザーネーム生成用の単語リスト（Figmaより）

// リストA: 食材1（login_6）
export const wordListA = [
  'エビ', '大豆', 'さといも', 'トマト', 'ほうれん草',
  'かまぼこ', 'サーモン', '牛', '鮭', '生クリーム',
  '豚', 'マヨ', 'にんじん', 'さつまいも', 'バナナ',
  'りんご', '餡', 'いか', 'マカロニ', 'ブロッコリー',
  'えのき', '鶏', 'カサゴ', 'じゃがいも', 'ねぎ',
  'もずく', '牡蠣', 'チョコ', 'ハバネロ', 'キャベツ',
]

// リストB: 食材2（login_7）
export const wordListB = [
  'たまねぎ', 'さば', 'さといも', 'コーン', 'エリンギ',
  '卵', '豆腐', 'バター', 'たけのこ', '黒豆',
  'きくらげ', 'ピーマン', '大根', 'わかめ', 'しめじ',
  '芽キャベツ', 'かぼちゃ', 'ホタテ', 'かぶ', 'ごぼう',
  'タコ', 'のり', 'ちくわ', 'なす', 'チーズ',
  'にんにく', '白菜', 'マグロ', 'グレープ', 'ケチャップ',
]

// リストC: 料理（login_8）
export const wordListC = [
  '丼', 'うどん', 'の太巻き', '汁', 'バーガー',
  'スープ', 'カレー', 'カツ', 'ジャム', '寿司',
  '鍋', 'そば', 'ラーメン', '軍艦', '焼き',
  'しゃぶしゃぶ', '蒸し', 'シチュー', 'アヒージョ', 'ケーキ',
  '煮', 'ホイル焼き', 'コロネ', 'サラダ', 'プリン',
  'キムチ', '(生)', '炒め', '串', 'おにぎり',
]

// ユーザーネーム生成
export function generateUsername(word1: string, word2: string, word3: string): string {
  return `${word1}${word2}${word3}`
}

// ランダムでユーザーネーム生成（テスト用）
export function generateRandomUsername(): string {
  const w1 = wordListA[Math.floor(Math.random() * wordListA.length)]
  const w2 = wordListB[Math.floor(Math.random() * wordListB.length)]
  const w3 = wordListC[Math.floor(Math.random() * wordListC.length)]
  return generateUsername(w1, w2, w3)
}
