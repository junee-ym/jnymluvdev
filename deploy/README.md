# Oracle Cloud 셀프호스팅 가이드

## 1. 서버 준비
- Oracle Cloud Always Free: VM.Standard.A1.Flex (ARM, 4 OCPU / 24GB), Ubuntu 22.04
- VCN 보안목록/iptables에서 80, 443 개방. DNS A레코드: SITE_DOMAIN, API_DOMAIN → 서버 공인 IP
- 7일 회수 방지: 계정을 Pay-As-You-Go로 업그레이드(무료 한도 내 과금 없음)
- Docker 설치: `curl -fsSL https://get.docker.com | sh`

## 2. Supabase 셀프호스팅
```bash
git clone --depth 1 https://github.com/supabase/supabase ~/supabase-src
cp -r ~/supabase-src/docker ~/supabase && cd ~/supabase
cp .env.example .env   # 비밀번호/JWT_SECRET/ANON_KEY/SERVICE_ROLE_KEY 새로 생성(공식 문서 절차)
```
`.env` 필수 수정: `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`(=API 도메인), `ADDITIONAL_REDIRECT_URLS`,
`SMTP_*`(Gmail 앱 비밀번호), `GOTRUE_EXTERNAL_GOOGLE_*`(Google OAuth).
kong 포트(8000)는 외부에 노출하지 말고 `family` 네트워크로만 접근:
```bash
docker network create family
# supabase compose의 kong 서비스에 networks: [default, family] 추가, 하단에 family: {external: true}
docker compose up -d
```

## 3. DB/스토리지 이전
```bash
# 기존 Supabase에서 (public 스키마 + auth.users)
pg_dump "$OLD_DB_URL" --schema=public --no-owner -f public.sql
pg_dump "$OLD_DB_URL" --data-only --table=auth.users --table=auth.identities -f auth.sql
# 새 서버 DB에 적용 후, supabase/migrations 중 누락분 확인
psql "$NEW_DB_URL" -f public.sql -f auth.sql
```
사진(`photos` 버킷)은 Storage S3 호환 엔드포인트로 rclone 복사 또는 스크립트로 이전.

## 4. 앱 배포
```bash
cd ~/jnymluvdev/deploy && cp .env.example .env  # 값 채우기
docker compose --env-file .env up -d --build
```
Google Cloud Console의 OAuth 리디렉션 URI를 `https://<API_DOMAIN>/auth/v1/callback`으로 교체.

## 5. 백업(필수)
매일 cron: `docker exec supabase-db pg_dump -U postgres postgres | gzip > backup-$(date +%F).sql.gz`
→ Oracle Object Storage(무료 20GB)로 업로드, 최근 14개 보관.
