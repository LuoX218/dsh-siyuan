#!/bin/bash
# dsh-siyuan-sync 安装脚本
#
# 按「第三方插件」的标准方式安装：写进 profile 的 dependencies 与
# dsh.profile.bundles，这样它才会出现在「设置 → 插件」的第三方插件列表里，
# 可以像市场插件一样启用/停用。
#
#   ./install.sh                 装到 desktop profile（默认）
#   ./install.sh --profile web   装到指定 profile
#   ./install.sh --dry-run       只打印将要做什么

set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE="desktop"
DRY_RUN=0
PKG_NAME="dsh-siyuan-sync"

while [ $# -gt 0 ]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
MANIFEST="$PROFILE_DIR/package.json"
LINK="$PROFILE_DIR/node_modules/$PKG_NAME"

if [ ! -f "$MANIFEST" ]; then
  echo "找不到 profile: $MANIFEST" >&2
  exit 1
fi

run() {
  if [ "$DRY_RUN" -eq 1 ]; then echo "[dry-run] $*"; else eval "$@"; fi
}

echo "==> 插件目录: $PLUGIN_DIR"
echo "==> 目标 profile: $PROFILE_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
cp "$MANIFEST" "$MANIFEST.bak-$STAMP"
echo "==> 已备份: package.json.bak-$STAMP"

# 1) 链接到 node_modules（file: 依赖的等价物，无需 pnpm 联网）
if [ -e "$LINK" ] && [ ! -L "$LINK" ]; then
  echo "警告: $LINK 已存在且不是软链，跳过" >&2
else
  run "mkdir -p '$PROFILE_DIR/node_modules'"
  run "ln -sfn '$PLUGIN_DIR' '$LINK'"
  echo "==> 已链接到 node_modules"
fi

# 2) 写进 package.json 的 dependencies 与 bundles
if [ "$DRY_RUN" -eq 1 ]; then
  echo "[dry-run] 在 dependencies 加入 \"$PKG_NAME\": \"file:$PLUGIN_DIR\""
  echo "[dry-run] 在 dsh.profile.bundles 追加 $PKG_NAME"
else
  python3 - "$MANIFEST" "$PKG_NAME" "$PLUGIN_DIR" <<'PY'
import json, sys
manifest, name, plugin_dir = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.load(open(manifest, encoding="utf-8"))

deps = data.setdefault("dependencies", {})
deps[name] = "file:" + plugin_dir

profile = data.setdefault("dsh", {}).setdefault("profile", {})
bundles = profile.setdefault("bundles", [])
if name not in bundles:
    bundles.append(name)

json.dump(data, open(manifest, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("==> 已写入 dependencies 与 bundles")
PY
fi

echo ""
echo "完成。重启 DeepSeek Harness 后："
echo "  · 设置 → 插件 → 第三方插件，可以看到 ${PKG_NAME}，可启用/停用"
echo "  · 右键任意消息 → 「同步到思源」"
echo ""
echo "回滚：./uninstall.sh --profile $PROFILE"
