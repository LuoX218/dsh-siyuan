#!/bin/bash
# 推送 dsh-siyuan-sync 到 GitHub
set -e

REPO_URL="https://github.com/LuoX218/dsh-siyuan.git"
cd "$(dirname "$0")"

echo "=== 1. 设置 remote ==="
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"
git remote -v

echo ""
echo "=== 2. 分支改名 main ==="
git branch -M main 2>/dev/null || true

echo ""
echo "=== 3. 推送 ==="
echo "如果卡在网络连接，先处理代理；如果提示认证，用 Personal Access Token 当密码。"
echo ""
git push -u origin main

echo ""
echo "=== 完成 ==="
git log --oneline -1
