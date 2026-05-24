// Agu's RPG item and collection data v2
// 初回クリア後のやり込み要素や、見えていたが行けなかった場所の解放に使う。

window.AGU_ITEMS = {
  forest_charm: {
    name: '森の守り札',
    type: 'clear_reward',
    fromStage: 'forest',
    description: '森の奥で拾った小さな守り札。倒木のそばにある古い印に反応する。',
    unlocks: ['forest_hidden_stump']
  },
  rusted_key: {
    name: '錆びた家鍵',
    type: 'clear_reward',
    fromStage: 'abandoned_village',
    description: '廃村の古い家を開けられる鍵。',
    unlocks: ['village_locked_house']
  },
  cave_lantern: {
    name: '洞窟ランタン',
    type: 'clear_reward',
    fromStage: 'cave',
    description: '暗い道を照らすランタン。洞窟の奥の見えなかった道が見える。',
    unlocks: ['cave_dark_path']
  },
  climbing_boots: {
    name: '登山靴',
    type: 'clear_reward',
    fromStage: 'mountain',
    description: '崖道を進むための靴。山の細い道を通れるようになる。',
    unlocks: ['mountain_cliff_path']
  },
  ruin_crest: {
    name: '遺跡の紋章',
    type: 'clear_reward',
    fromStage: 'ruins',
    description: '遺跡の封印扉を開ける紋章。廃城への道を示す。',
    unlocks: ['castle_outer_seal']
  },
  royal_ring: {
    name: '王家の指輪',
    type: 'clear_reward',
    fromStage: 'ruined_castle',
    description: '廃城の最奥で見つかる指輪。真エンドの鍵になる予定。',
    unlocks: ['castle_hidden_room']
  }
};

window.AGU_COLLECTIONS = {
  memory_ami_ribbon: {
    name: 'amiの青いリボンの切れ端',
    category: 'amiとの思い出',
    location: 'forest_hidden_stump',
    description: '森の倒木の近くに残っていた青いリボン。amiが一度ここにいた証。'
  },
  old_notice: {
    name: '破れた村の掲示紙',
    category: '隠し手紙',
    location: 'village_locked_house',
    description: '村人が消える前日に貼られていた警告文。最後の一文だけ読めない。'
  },
  stone_fragment: {
    name: '古い石板の欠片',
    category: '石板',
    location: 'cave_dark_path',
    description: '時間を巻き戻す力について刻まれた石片。'
  },
  weathered_medal: {
    name: '兵士の古い勲章',
    category: '失われた道具',
    location: 'mountain_cliff_path',
    description: '昔、廃城を守っていた兵士のものらしい。'
  },
  elder_note: {
    name: '村長の古い手記',
    category: '古文書',
    location: 'ruins_hidden_archive',
    description: '村長が隠していた真相の一部。廃城と村の関係が書かれている。'
  },
  castle_lullaby: {
    name: '廃城の子守唄',
    category: '真エンド用の手がかり',
    location: 'castle_hidden_room',
    description: 'amiが小さい頃に聞いたという歌。真エンドで使う予定。'
  }
};
