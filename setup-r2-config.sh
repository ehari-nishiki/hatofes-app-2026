#!/bin/bash

# Cloudflare R2の環境変数をFirebase Cloud Functionsに設定

echo "Firebase Cloud Functionsの環境変数を設定中..."

firebase functions:config:set \
  r2.access_key_id="02b84967a692e65517f21b41641b5f4a" \
  r2.secret_access_key="f3c32cc0745236be8769efd9a8d2569f9fed1b3c22d30e1af68b6a61e030c28b" \
  r2.account_id="527a60cdb96ee09801d983b2487cc47f" \
  r2.bucket_name="hatofes-uploads" \
  r2.public_url="https://pub-09bebd4abe824e2eb27f3b2a9d2e110f.r2.dev"

echo ""
echo "✅ 環境変数の設定が完了しました"
echo ""
echo "設定内容を確認:"
firebase functions:config:get
