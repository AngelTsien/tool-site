# 🧰 小工具站

好用、免费、全部在浏览器里运行的中文小工具合集（共 124 个）。手机电脑都能用，数据只保存在你自己的浏览器（localStorage），不上传服务器。

## 🚀 部署到 GitHub Pages

1. 把本仓库推到 GitHub。
2. 仓库 **Settings → Pages**，Source 选 `Deploy from a branch`，分支 `main`，目录 `/ (root)`。
3. 稍等片刻，访问 `https://<用户名>.github.io/<仓库名>/` 即可。

> 所有页面使用相对路径、第三方库已放在 `static/vendor/`，不依赖任何 CDN，可直接静态托管。
> 唯一例外：**💇 发型试换** 需要后端 `app.py`（Flask + AI 接口密钥），在 GitHub Pages 上只能演示界面。

## 🛠 本地运行 / 修改

```bash
python3 build.py          # 由 tools_batch*.py 生成 index.html 和 tools/*.html
python3 -m http.server 8000   # 纯静态预览
# 或 python3 app.py（含发型试换后端）
```

新增工具：在 `build.py` 的 `TOOLS` 列表加一行，在 `tools_batchN.py` 里写 `P["key"]=(html, js)`，再运行 `build.py`。

## 📋 工具列表

### ✝️ 教会与讲道

| 工具 | 说明 |
|---|---|
| 📖 [经文卡片](tools/verse.html) | 输入经文，生成温柔背景的分享图 |
| ⏱️ [讲道计时器](tools/timer.html) | 大字倒计时，剩余时间颜色提醒 |
| 🗓 [读经计划](tools/readplan.html) | 按天数自动生成全本/新约/旧约读经表 |
| 🗒️ [讲道大纲排版](tools/outline.html) | 粘贴大纲，自动排成美观讲章，可打印 |
| 💌 [邀请函/海报](tools/invite.html) | 聚会邀请卡，一键下载图片 |
| ✏️ [经文默写](tools/cloze.html) | 挖空练习背经文 |
| 🎯 [Kahoot 题目表](tools/kahoot.html) | 文字题目一键转成 Kahoot 导入表格 |
| 📋 [事奉排班表](tools/rota.html) | 按人员与岗位自动轮值排班 |
| 🎸 [和弦移调](tools/chords.html) | 歌谱和弦一键转调 |
| 🥁 [节拍器](tools/metronome.html) | BPM、拍号、重音、点击测速 |
| 🎻 [调音器](tools/tuner.html) | 麦克风识别音高，吉他调音 |
| 📜 [讲道提词器](tools/prompter.html) | 大字自动滚动提词，可镜像、调速 |
| 🔥 [背经打卡](tools/checkin.html) | 每日背诵经文，记录连续天数 |
| 🙏 [祷告事项本](tools/prayer.html) | 记录代祷事项与蒙应允的见证 |
| 📚 [书卷顺序练习](tools/bookorder.html) | 按顺序点出圣经书卷，熟记 66 卷 |
| ❓ [圣经问答测验](tools/quiz.html) | 导入自己的题库，随机出题计分 |
| 📈 [读经进度](tools/bibleprog.html) | 66 卷逐章勾选，看整本圣经读了多少 |
| ⭐ [贴纸奖励表](tools/sticker.html) | 儿童主日学点名贴星星，排行榜 |
| 🖊️ [聚会签到](tools/attend.html) | 名单点名签到，统计出席，导出 |
| 🎤 [歌词投影](tools/lyrics.html) | 诗歌歌词全屏分页投影，键盘翻页 |
| 📰 [主日周报](tools/bulletin.html) | 填写程序与报告，生成可打印周报 |
| 💒 [奉献统计](tools/offering.html) | 按类别/日期登记奉献，自动汇总 |
| 🔠 [圣经找字](tools/wordsearch.html) | 在字母方阵中找出圣经词语 |
| 🕵️ [圣经人物猜猜看](tools/guess.html) | 根据线索猜人物，线索越少分越高 |
| 💬 [查经讨论卡](tools/study.html) | 观察-解释-应用三层问题卡，小组用 |
| 🪧 [倒计时海报](tools/cdposter.html) | 活动倒数天数海报，一键下载 |
| 📦 [物品借还登记](tools/lend.html) | 教会图书/器材借出归还，逾期提醒 |
| 🎄 [节日倒数日历](tools/festivals.html) | 教会节期与中西节日倒数 |
| 📇 [小组通讯录](tools/contacts.html) | 联系人卡片，导出 vCard/CSV |
| ✝️ [一年读完新约](tools/ntplan.html) | 按日期生成读经表，可打卡可打印 |
| 📔 [灵修日记](tools/journal.html) | 日历+心情+经文领受，自动保存 |
| 🗳️ [投票表决器](tools/vote.html) | 手机传递匿名投票，自动计票 |

### 🏠 生活助手

| 工具 | 说明 |
|---|---|
| 🗓️ [日期计算/农历](tools/date.html) | 天数差、加减天数、公历农历对照 |
| 🏦 [房贷计算器](tools/loan.html) | 等额本息/等额本金，月供与总利息 |
| ⚖️ [BMI 计算](tools/bmi.html) | 身高体重算 BMI，中国标准判断 |
| 📏 [单位换算](tools/unit.html) | 长度、重量、温度、面积、体积 |
| 🍅 [番茄钟](tools/pomodoro.html) | 25 分钟专注 + 5 分钟休息 |
| ✅ [待办清单](tools/todo.html) | 记录待办，自动保存在本机 |
| 💰 [记账本](tools/ledger.html) | 收支记录与分类统计，本机保存 |
| ⏳ [倒数日](tools/countdown.html) | 重要日子倒数/纪念日累计 |
| ➗ [计算器](tools/calc.html) | 大按钮计算器，支持键盘 |
| 🧧 [收据生成](tools/receipt.html) | 填写项目自动计算，打印收据 |
| 🧮 [个税计算](tools/tax.html) | 中国工资薪金个税，累计预扣逐月明细 |
| 🍽️ [AA 分账](tools/split.html) | 多人垫付，算清谁该转给谁 |
| 🌍 [时区转换](tools/timezone.html) | 罗马、北京、纽约等多城市时间对照 |
| 🚰 [喝水/体重记录](tools/health.html) | 每日喝水打卡与体重趋势图 |
| 🍜 [今天吃什么](tools/eat.html) | 自定义菜单，随机滚动帮你决定 |
| ％ [百分比/折扣](tools/percent.html) | 打折、涨跌幅、占比、满减一算就懂 |
| 🧳 [旅行打包清单](tools/packing.html) | 按场景生成清单，勾选打包进度 |
| 🎂 [生日提醒](tools/birthday.html) | 记录生日，按最近排序，显示年龄 |
| 📆 [习惯打卡](tools/habit.html) | 多个习惯每日打卡，热力图与连续天数 |
| ⏲️ [秒表计次](tools/stopwatch.html) | 精确到 0.01 秒，计次与分段 |
| 📐 [水平仪/尺子](tools/level.html) | 手机水平仪与屏幕刻度尺 |
| 🧭 [课程表/周计划](tools/schedule.html) | 拖填一周时间表，可打印导出 |
| 🏠 [装修材料估算](tools/reno.html) | 房间面积、油漆、地板、瓷砖用量 |
| ⛽ [油费/电费计算](tools/fuel.html) | 行程油耗、费用分摊、百公里成本 |
| 👶 [宝宝月龄/预产期](tools/baby.html) | 预产期、孕周、宝宝月龄与天数 |
| 🐉 [生肖星座/年龄](tools/zodiac.html) | 生日查生肖、星座、周岁虚岁 |
| 🍎 [热量估算](tools/calorie.html) | 每日所需热量与常见食物热量 |
| 📅 [年历打印](tools/calendar.html) | 整年/单月日历，含农历节气，可打印 |
| 🧾 [生活缴费记录](tools/bills.html) | 水电燃气网费记录与月度趋势 |
| 🏘️ [合租分摊](tools/rent.html) | 房租水电按人头/面积/天数分摊 |
| 🎙️ [会议计时/发言排队](tools/meeting.html) | 发言队列、每人限时、超时提醒 |
| 🧑‍💼 [简历生成](tools/resume.html) | 填表即得排版简历，打印存 PDF |

### ✍️ 文字处理

| 工具 | 说明 |
|---|---|
| 📝 [字数统计](tools/count.html) | 中文字、英文词、标点、预计朗读时长 |
| 🈶 [简繁转换](tools/convert.html) | 简体 ⇄ 繁体，离线转换 |
| 🔤 [拼音注音](tools/pinyin.html) | 汉字加拼音，可显示在字上方 |
| 🔊 [文字朗读](tools/tts.html) | 把文字读出来，可调语速 |
| 🔧 [JSON 格式化](tools/json.html) | 格式化、压缩、校验 JSON |
| 🔐 [密码生成器](tools/password.html) | 安全随机密码，可选字符类型 |
| 📄 [Markdown 预览](tools/markdown.html) | 边写边预览，可复制 HTML |
| 🧹 [文本整理](tools/textops.html) | 去重、排序、去空行、编号、大小写 |
| 🔍 [正则测试](tools/regex.html) | 实时高亮匹配、分组与替换 |
| 🎉 [祝福语生成](tools/blessing.html) | 节日/生日/婚礼祝福语模板，一键复制 |
| 🆚 [文本对比](tools/diff.html) | 两段文字逐行/逐字找不同 |
| 🔣 [编码转换](tools/encode.html) | 进制、Base64、URL、Unicode 互转 |
| 💚 [公众号排版](tools/wxformat.html) | Markdown 写作，一键复制带样式正文 |
| 📜 [竖排古风文字](tools/vertical.html) | 文字竖排成古风宣纸图片 |

### 🎨 图片与设计

| 工具 | 说明 |
|---|---|
| 🖼️ [图片压缩/转换](tools/image.html) | 压缩体积、调整尺寸、转 JPG/PNG/WebP |
| 💧 [图片加水印](tools/watermark.html) | 文字水印，可平铺、调透明度 |
| 🎨 [调色板/取色](tools/color.html) | 取色、生成配色、从图片提取颜色 |
| 🔳 [二维码生成](tools/qr.html) | 网址或文字一键生成二维码 |
| 💇 [发型试换](tools/hairstyle.html) | 上传自拍，预览不同发型 |
| 👤 [头像裁剪](tools/avatar.html) | 拖动缩放，导出方形/圆形头像 |
| 🖌️ [白板画板](tools/board.html) | 手绘、橡皮、颜色、导出图片 |
| ▥ [条形码生成](tools/barcode.html) | Code128 / EAN-13 等条码，下载图片 |
| 🌗 [颜色对比度](tools/contrast.html) | 检查文字与背景是否清晰易读（WCAG） |
| 🪟 [图片拼长图](tools/longimg.html) | 多张图片竖排/横排拼接成一张 |
| 🔲 [九宫格切图](tools/grid9.html) | 一张图切成 3×3 等宫格，朋友圈用 |
| 🅰️ [艺术字标题图](tools/arttext.html) | 渐变、描边、阴影标题图一键导出 |
| 🌈 [渐变生成器](tools/gradient.html) | 线性/径向渐变，复制 CSS、下载壁纸 |
| 🪞 [CSS 阴影生成](tools/shadow.html) | 可视化调阴影/圆角，复制代码 |
| 🔡 [图片转字符画](tools/ascii.html) | 照片变成文字艺术，可复制/下载 |
| 📷 [照片信息/去隐私](tools/exif.html) | 查看 EXIF（时间、相机、GPS）并去除 |
| ✒️ [电子签名](tools/signature.html) | 手写签名，透明背景 PNG 导出 |
| 🪪 [证件照换底/排版](tools/idphoto.html) | 换白蓝红底，一寸二寸 6 寸排版 |
| 📲 [二维码名片](tools/qrcard.html) | 扫码即存通讯录的电子名片 |

### 📚 学习与孩子

| 工具 | 说明 |
|---|---|
| ⌨️ [打字练习](tools/typing.html) | 中英文打字速度与正确率 |
| 🗂️ [闪卡记忆](tools/flashcard.html) | 自制卡片，翻面记忆，经文/单词 |
| ✍️ [字帖生成](tools/copybook.html) | 田字格/米字格练字帖，描红打印 |
| ➕ [口算题生成](tools/mathgen.html) | 加减乘除口算练习卷，可打印带答案 |
| ✖️ [乘法表练习](tools/times.html) | 九九乘法表 + 限时挑战 |
| 🎧 [单词听写](tools/dictation.html) | 自定义词表，朗读听写并批改 |
| 🎹 [钢琴键盘/简谱](tools/piano.html) | 可弹奏的钢琴，简谱自动播放 |
| 🧸 [亲子故事卡](tools/story.html) | 随机角色地点难题，一起编故事 |

### 🎲 游戏与趣味

| 工具 | 说明 |
|---|---|
| 👥 [随机分组/抽签](tools/group.html) | 名单随机分组，或抽一个人 |
| 🎡 [幸运大转盘](tools/wheel.html) | 自定义选项，转盘抽奖 |
| 🎲 [掷骰子](tools/dice.html) | 1–6 颗骰子，带动画 |
| 🎴 [记忆翻牌](tools/memory.html) | 翻牌配对小游戏 |
| 🌧️ [白噪音](tools/noise.html) | 雨声、海浪、白/粉/棕噪音，可定时 |
| 🧩 [拼图游戏](tools/puzzle.html) | 用自己的照片玩滑块拼图 |
| ⚫ [五子棋](tools/gomoku.html) | 人机对战，简单 AI |
| 🔢 [数独](tools/sudoku.html) | 自动出题，三种难度，可提示检查 |
| 🧱 [俄罗斯方块](tools/tetris.html) | 经典方块，键盘/触屏操作 |
| 💣 [扫雷](tools/mines.html) | 三种难度，长按/右键插旗 |
| 🐍 [贪吃蛇](tools/snake.html) | 经典贪吃蛇，可穿墙/加速 |
| ⚡ [反应力测试](tools/reaction.html) | 反应速度 + 打地鼠 |
| 🃏 [二十四点](tools/game24.html) | 四个数凑 24，带提示与答案 |
| ⭕ [井字棋](tools/ttt.html) | 双人或挑战不会输的 AI |
| 💎 [消消乐](tools/match3.html) | 三消小游戏，限步数挑战 |
| 🔮 [抽奖号码球](tools/lottery.html) | 号码球摇奖，不重复，可排除 |
| ♟️ [中国象棋](tools/xiangqi.html) | 双人对弈，走法校验、悔棋 |
| 🔴 [四子棋](tools/connect4.html) | 人机/双人，四子连线获胜 |
| 🟧 [2048 小游戏](tools/game2048.html) | 滑动合并数字，休息一下 |

## 📄 许可

自由使用、分享。第三方库（qrcode-generator、opencc-js、pinyin-pro、lunar-javascript、SheetJS、JsBarcode）各自遵循其原始许可。
