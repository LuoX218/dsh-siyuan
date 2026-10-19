#!/bin/bash
# dsh-siyuan-sync 卸载脚本：完全还原安装前状态。
set -euo pipefail

DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE="desktop"
PKG_NAME="dsh-siyuan-sync"

while [ $# -gt 0 ]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    -h|--help) sed -n '2,3p' "$0"; exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
MANIFEST="$PROFILE_DIR/package.json"
PATCH="$PROFILE_DIR/cordis.patch.yml"
LINK="$PROFILE_DIR/node_modules/$PKG_NAME"

if [ -L "$LINK" ]; then rm -f "$LINK"; echo "==> 已移除软链"; fi

if [ -f "$MANIFEST" ]; then
  cp "$MANIFEST" "$MANIFEST.bak-uninstall-$(date +%Y%m%d-%H%M%S)"
  python3 - "$MANIFEST" "$PKG_NAME" <<'PY'
import json, sys
manifest, name = sys.argv[1], sys.argv[2]
data = json.load(open(manifest, encoding="utf-8"))
data.get("dependencies", {}).pop(name, None)
profile = data.get("dsh", {}).get("profile", {})
bundles = profile.get("bundles", [])
if name in bundles:
    bundles.remove(name)
json.dump(data, open(manifest, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("==> 已从 dependencies 与 bundles 移除")
PY
fi

# 兼容早期版本的挂载行
if [ -f "$PATCH" ] && grep -q "$PKG_NAME" "$PATCH"; then
  cp "$PATCH" "$PATCH.bak-uninstall-$(date +%Y%m%d-%H%M%S)"
  python3 - "$PATCH" <<'PY'
import sys, re
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
blocks = re.split(r'(?m)^(?=- insert:)', text)
kept = [b for b in blocks if "dsh-siyuan-sync" not in b]
out = "".join(kept).strip()
open(path, "w", encoding="utf-8").write((out + "\n") if out else "[]\n")
print("==> 已清理旧挂载行")
PY
fi

echo "完成。插件数据保留在 $DSH_HOME/plugin-data/dsh-siyuan-sync。"
