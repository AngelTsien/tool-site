/* 示例数据：全部为公有领域文本（John Newton 1779《Amazing Grace》；和合本 1919；KJV 1611） */
(function (g) {
  const LP = g.LP = g.LP || {};
  LP.seed = function (today) {
    const songs = [
      {
        id: 's-amazing-grace', title: 'Amazing Grace', tags: ['敬拜', '感恩', '诗歌本'], key: 'G', tempo: '慢 72', lang: '英文',
        arrangement: 'V1 V2 V3 V4',
        lyrics: `[V1]
Amazing grace! How sweet the sound
That saved a wretch like me!
I once was lost, but now am found;
Was blind, but now I see.

[V2]
'Twas grace that taught my heart to fear,
And grace my fears relieved;
How precious did that grace appear
The hour I first believed.

[V3]
Through many dangers, toils and snares,
I have already come;
'Tis grace hath brought me safe thus far,
And grace will lead me home.

[V4]
When we've been there ten thousand years,
Bright shining as the sun,
We've no less days to sing God's praise
Than when we'd first begun.`, created: Date.now()
      },
      {
        id: 's-psalm-23', title: '诗篇 23 篇（中英对照示例）', tags: ['经文', '敬拜'], key: '', tempo: '', lang: '中英', arrangement: '',
        lyrics: `耶和华是我的牧者，我必不致缺乏。
The LORD is my shepherd; I shall not want.

他使我躺卧在青草地上，领我在可安歇的水边。
He maketh me to lie down in green pastures: he leadeth me beside the still waters.

他使我的灵魂苏醒，为自己的名引导我走义路。
He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake.

我虽然行过死荫的幽谷，也不怕遭害，因为你与我同在；
Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me;

你的杖，你的竿，都安慰我。
thy rod and thy staff they comfort me.

在我敌人面前，你为我摆设筵席；你用油膏了我的头，使我的福杯满溢。
Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over.

我一生一世必有恩惠慈爱随着我；我且要住在耶和华的殿中，直到永远。
Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever.`, created: Date.now()
      }
    ];
    const setlists = [{
      id: 'set-sample', name: '示例：主日崇拜', date: today, items: [
        { type: 'logo' },
        { type: 'song', songId: 's-amazing-grace' },
        { type: 'text', title: '约翰福音 3:16', text: '神爱世人，甚至将他的独生子赐给他们，叫一切信他的，不至灭亡，反得永生。\nFor God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' },
        { type: 'song', songId: 's-psalm-23' }
      ], updated: Date.now()
    }];
    return { songs, setlists };
  };
})(window);
