#!/usr/bin/env bash
# ⚠️ 수동 배포 — 평상시엔 쓰지 않는다.
#
# main 에 푸시하면 Vercel이 자동 배포한다(Git 연동). 이 스크립트는
# Git 연동이 끊겼거나 긴급히 로컬에서 올려야 할 때만 쓰는 비상구다.
#
# 자동 배포와 다른 점: 커밋과 연결되지 않아 무엇이 올라갔는지 추적이 안 된다.
# 쓴 뒤에는 반드시 같은 코드를 main 에 푸시해 둘 것.

set -euo pipefail
cd "$(dirname "$0")"

read -rp "자동 배포 대신 수동으로 올립니다. 계속할까요? [y/N] " ans
[[ "$ans" == [yY] ]] || { echo "취소"; exit 1; }

echo "▶ 빌드 + 배포 (vercel.json 설정을 따름)"
npx vercel deploy --prod --yes
