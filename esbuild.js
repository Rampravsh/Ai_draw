const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function copyStaticAssets() {
  const distDir = path.join(__dirname, "dist");
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Copy webview index.html and style.css
  const webviewSrc = path.join(__dirname, "src", "webview");
  if (fs.existsSync(webviewSrc)) {
    const filesToCopy = ["index.html", "style.css"];
    for (const file of filesToCopy) {
      const srcFile = path.join(webviewSrc, file);
      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, path.join(distDir, file));
      }
    }
  }

  // Copy icon.png to dist
  const rootIcon = path.join(__dirname, "icon.png");
  if (fs.existsSync(rootIcon)) {
    fs.copyFileSync(rootIcon, path.join(distDir, "icon.png"));
  }
}

async function main() {
  await copyStaticAssets();

  const extensionConfig = {
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "dist/extension.js",
    external: ["vscode"],
    logLevel: "silent",
  };

  const webviewConfig = {
    entryPoints: ["src/webview/app.ts"],
    bundle: true,
    format: "iife",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "browser",
    outfile: "dist/webview.js",
    logLevel: "silent",
  };

  if (watch) {
    const extCtx = await esbuild.context(extensionConfig);
    const webCtx = await esbuild.context(webviewConfig);
    await Promise.all([extCtx.watch(), webCtx.watch()]);
    console.log("[esbuild] Watching for changes...");
  } else {
    await Promise.all([
      esbuild.build(extensionConfig),
      esbuild.build(webviewConfig),
    ]);
    console.log("[esbuild] Build complete!");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
