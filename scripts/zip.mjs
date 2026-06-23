// 打包脚本：只把「运行时需要的文件」打进 dist/moesora.zip
// 源码（src/、vite.config 等）不进安装包。
import { createWriteStream, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = resolve(root, "dist");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const output = createWriteStream(resolve(outDir, "moesora.zip"));
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", () =>
  console.log(`moesora.zip 打包完成：${archive.pointer()} 字节`)
);
archive.on("warning", (e) => console.warn(e));
archive.on("error", (e) => { throw e; });

archive.pipe(output);

// 安装包根目录直接包含 theme.yaml 等（不要多套一层文件夹）
archive.file(resolve(root, "theme.yaml"), { name: "theme.yaml" });
archive.file(resolve(root, "settings.yaml"), { name: "settings.yaml" });
archive.directory(resolve(root, "templates"), "templates");

archive.finalize();
