// Agu's RPG character data v2
// 30人の救助対象。amiはStage 1とStage 6で物語上2回登場するが、救助カウントは30人設計に合わせて管理する。

window.AGU_CHARACTERS = {
  ami: {
    name: 'ami', gender: '女', age: 20, job: '若者', relation: 'Aguの恋人', important: true,
    design: '栗色の髪を肩で結び、青いリボンをつけた若者。強がりだが目は優しい。',
    personality: '明るく行動的。Aguの前では少しだけ素直になれない。',
    rescueLine: 'Agu……来てくれるって信じてた。けど、村のみんながまだ戻ってないの。お願い、一緒に助けて。',
    finalRescueLine: 'もう一度、見つけてくれたね。今度は、ちゃんと一緒に帰ろう。'
  },

  c02:{name:'ニナ',gender:'女',age:8,job:'子供',design:'赤いずきんと大きな木の実袋。',personality:'泣き虫だが観察力がある。',rescueLine:'こわかった……でもAguお兄ちゃんの足音、ちゃんと分かったよ。'},
  c03:{name:'トト',gender:'男',age:10,job:'子供',design:'泥だらけの半ズボンと木の枝の剣。',personality:'冒険ごっこが好きな元気者。',rescueLine:'ぼく、全然泣いてないからな！ でも助けに来てくれてありがと！'},
  c04:{name:'ミラ',gender:'女',age:14,job:'子供',design:'黄色い三つ編みと古い絵本。',personality:'年下の子の面倒を見るしっかり者。',rescueLine:'小さい子たちを先に助けて。私は……ううん、やっぱり少し怖かった。'},
  c05:{name:'ケイ',gender:'男',age:12,job:'子供',design:'大きな丸眼鏡と石ころ入りのポーチ。',personality:'好奇心旺盛で遺跡好き。',rescueLine:'この場所、変な印があったんだ。あとでAguにも見せたい。'},

  c06:{name:'ラウル',gender:'男',age:34,job:'商人',design:'緑の外套と革の帳簿。',personality:'損得に敏いが情に厚い。',rescueLine:'命の値段だけは帳簿につけられないな。助かったよ。'},
  c07:{name:'セリア',gender:'女',age:29,job:'商人',design:'紫のスカーフと小さな天秤。',personality:'交渉上手で冷静。',rescueLine:'この恩は高くつくわよ。もちろん、いい意味でね。'},
  c08:{name:'バン',gender:'男',age:42,job:'商人',design:'太い腕と屋台用の前掛け。',personality:'豪快な料理人。',rescueLine:'腹が減っては救助もできん！ 帰ったら何か焼いてやる！'},
  c09:{name:'ミネット',gender:'女',age:51,job:'商人',design:'銀縁眼鏡と薬草の小瓶。',personality:'毒舌だが面倒見がいい。',rescueLine:'まったく、薬より先に助けが必要になるとはね。ありがとう。'},

  c10:{name:'ガルド',gender:'男',age:31,job:'兵士',design:'傷のある盾と青いマント。',personality:'責任感が強い。',rescueLine:'守る側の私が助けられるとは……だが、まだ任務は終わっていない。'},
  c11:{name:'リザ',gender:'女',age:27,job:'兵士',design:'短い黒髪と軽装の鎧。',personality:'俊敏で判断が早い。',rescueLine:'敵の巡回には癖がある。Agu、焦らず見れば抜けられる。'},
  c12:{name:'オルテ',gender:'男',age:45,job:'兵士',design:'白髪混じりの髭と重い鎧。',personality:'古参で厳しいが優しい。',rescueLine:'若い者に助けられる日が来るとはな。悪くない。'},
  c13:{name:'サナ',gender:'女',age:22,job:'兵士',design:'赤い肩当てと真新しい槍。',personality:'新人で緊張しがち。',rescueLine:'怖かったです。でも、私も誰かを助けられる兵士になります。'},
  c14:{name:'ロイ',gender:'男',age:19,job:'兵士',design:'少し大きすぎる兜。',personality:'見習いだが勇敢。',rescueLine:'Aguさん、ぼくも逃げてばかりじゃいられません！'},

  c15:{name:'モリス',gender:'男',age:70,job:'隠居',design:'曲がった杖と古い帽子。',personality:'昔話が長い。',rescueLine:'ふぉっふぉ。わしを助けるとは、見る目がある若者じゃ。'},
  c16:{name:'エダ',gender:'女',age:68,job:'隠居',design:'白い髪を丸く結び、花柄の肩掛け。',personality:'穏やかで鋭い。',rescueLine:'ありがとう。朝の静けさが変だと思ったら、こんなことにね。'},
  c17:{name:'ダリオ',gender:'男',age:76,job:'隠居',design:'古い兵士の外套を羽織る老人。',personality:'元兵士で頑固。',rescueLine:'まだ若い者には負けん……と言いたいが、今日は助かった。'},
  c18:{name:'ハナ',gender:'女',age:81,job:'隠居',design:'小さな体と大きな編み物袋。',personality:'誰にでもお菓子を配る。',rescueLine:'まあまあAgu、こんな所まで。帰ったら温かいものを作ろうね。'},

  c19:{name:'ポルカ',gender:'女',age:33,job:'農民',design:'麦わら帽子と土のついた手袋。',personality:'働き者で明るい。',rescueLine:'畑を放っておけないんだ。助けてくれてありがとう！'},
  c20:{name:'ジオ',gender:'男',age:38,job:'農民',design:'日焼けした顔と大きな鍬。',personality:'無口だが力持ち。',rescueLine:'……助かった。この借りは収穫で返す。'},
  c21:{name:'ナナ',gender:'女',age:24,job:'農民',design:'青い作業服と花の髪飾り。',personality:'植物と話すように世話をする。',rescueLine:'苗たちの声が遠くなって怖かった。戻れてよかった。'},
  c22:{name:'テオ',gender:'男',age:16,job:'農民',design:'大きな籠を背負った少年。',personality:'背伸びしたがり。',rescueLine:'おれ、もう子供じゃないけど……今日はちょっと助かった。'},
  c23:{name:'マルタ',gender:'女',age:47,job:'農民',design:'白い前掛けと強い目。',personality:'村の母のような存在。',rescueLine:'Agu、無理はするんじゃないよ。でも本当にありがとう。'},
  c24:{name:'コリン',gender:'男',age:55,job:'農民',design:'太い眉と葡萄色のベスト。',personality:'果樹園を愛している。',rescueLine:'果樹園の道具が妙に荒らされていてな……何かがおかしい。'},
  c25:{name:'ルチア',gender:'女',age:36,job:'農民',design:'赤い腰布と水汲み桶。',personality:'世話焼きで声が大きい。',rescueLine:'助かったよ！ ほら、他の人も早く見つけてあげな！'},
  c26:{name:'ニール',gender:'男',age:28,job:'農民',design:'羊毛の上着と小さな笛。',personality:'動物に好かれる。',rescueLine:'羊たちが騒いでたんだ。敵が来る前に、動物は気づいてたのかも。'},
  c27:{name:'セナ',gender:'女',age:18,job:'農民',design:'若草色のバンダナと小さな鎌。',personality:'負けず嫌い。',rescueLine:'助けられっぱなしは嫌だな。次は私も役に立つから。'},
  c28:{name:'ブルーノ',gender:'男',age:63,job:'農民',design:'大きな腹と古い長靴。',personality:'陽気で歌好き。',rescueLine:'いやあ、怖い時ほど歌うべきだったな！ 声も出なかったが！'},

  c29:{name:'エルム',gender:'男',age:58,job:'村長',important:true,design:'白い髭と古い村章のペンダント。',personality:'穏やかだが重い秘密を抱える。',rescueLine:'Agu……ここまで来たか。廃城へ行け。amiは、あの城の最奥にいる。'},
  c30:{name:'ユリカ',gender:'女',age:23,job:'若者',design:'銀色の短髪と旅用のブーツ。',personality:'村の外に憧れる自由人。',rescueLine:'外の世界に出る前に、村ごと消えちゃうなんて冗談じゃないね。'}
};
