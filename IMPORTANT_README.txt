Moesora 主题 — 构建说明（重要）
================================
本主题已采用「构建模式」：脚本源码为 CoffeeScript，样式以 PostCSS 编写，经 Vite 构建。

源码位置：
  - 脚本：src/script/index.coffee   （交互脚本源码）
  - 样式：src/style/index.css       （入口 import，构建后输出 moesora.css）

构建命令：
  npm install        # 首次
  npm run build      # 编译 coffee + 打包 css -> templates/assets/dist/{moesora.js,moesora.css}
  npm run zip        # 打包主题 zip
  npm run package    # = build + zip

说明：
  - 所有改动请改源码（coffee/css）后执行 npm run build，不要直接修改 dist 产物。
