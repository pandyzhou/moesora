import { defineConfig } from "vite";
import { resolve } from "node:path";
import coffeescript from "coffeescript";

// --- 原创的极简 CoffeeScript 插件 ---------------------------------
// Vite 默认不认识 .coffee。这个插件在构建时把 .coffee 编译成 JS，
// 让它能像普通模块一样被打包。bare:true 避免包裹 IIFE，方便和 ESM 协作。
function coffeePlugin() {
  return {
    name: "moesora-coffee",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith(".coffee")) return null;
      const js = coffeescript.compile(code, {
        bare: true,
        inlineMap: false,
        filename: id,
      });
      return { code: js, map: null };
    },
  };
}

export default defineConfig({
  plugins: [coffeePlugin()],
  // src/public 下的静态文件（如 logo.svg）会被原样拷贝到 outDir 根（即 dist/），
  // 每次构建都会重新拷贝，因此即使 emptyOutDir 清空了 dist 也不会丢。
  publicDir: resolve(__dirname, "src/public"),
  build: {
    // 产物直接进入主题静态资源目录，供 Thymeleaf 模板引用
    outDir: resolve(__dirname, "templates/assets/dist"),
    emptyOutDir: true,
    // 不做 manifest，固定文件名，模板里写死路径即可
    rollupOptions: {
      input: {
        moesora: resolve(__dirname, "src/script/index.coffee"),
      },
      output: {
        entryFileNames: "moesora.js",
        chunkFileNames: "moesora-[name].js",
        assetFileNames: (info) => {
          // 入口里 import 的 css 会以 moesora.css 输出
          if (info.name && info.name.endsWith(".css")) return "moesora.css";
          return "[name][extname]";
        },
      },
    },
  },
});
