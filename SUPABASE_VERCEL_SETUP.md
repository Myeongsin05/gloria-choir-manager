# Vercel + Supabase 배포 설정

## 1. Supabase 프로젝트 생성

Supabase에서 새 프로젝트를 만든 뒤 SQL Editor에서 `supabase-schema.sql` 내용을 실행한다.

생성되는 항목:

- `public.app_kv`: 현재 앱의 `store`, `users`, `permissions`, `outbox` 데이터를 JSONB로 저장
- `score-files` Storage bucket: 악보 PDF/JPG/PNG 업로드 저장소

## 2. Supabase 키 확인

Supabase Dashboard에서 아래 값을 확인한다.

```text
Project Settings > API > Project URL
Project Settings > API > service_role key
```

`service_role key`는 서버 전용 비밀키이므로 브라우저 코드에 넣으면 안 된다. Vercel 환경변수에만 넣는다.

## 3. Vercel 환경변수

Vercel 프로젝트 Settings > Environment Variables에 아래 값을 추가한다.

```text
SUPABASE_URL=Supabase Project URL
SUPABASE_SERVICE_ROLE_KEY=Supabase service_role key
SUPABASE_STORAGE_BUCKET=score-files
SESSION_SECRET=아무 긴 랜덤 문자열
```

`SESSION_SECRET` 예시:

```text
choir-session-2026-change-this-to-random
```

환경변수를 추가한 뒤 반드시 다시 배포한다.

```bash
vercel --prod
```

## 4. 동작 방식

환경변수가 있으면 앱은 Supabase를 사용한다.

```text
store.json       -> app_kv key='store'
users.json       -> app_kv key='users'
permissions.json -> app_kv key='permissions'
mail-outbox.json -> app_kv key='outbox'
uploads/         -> Supabase Storage score-files bucket
```

환경변수가 없으면 기존처럼 로컬 JSON 파일과 `uploads/` 폴더를 사용한다.

## 5. 초기 로그인 계정

Supabase에 데이터가 비어 있으면 앱이 첫 접근 시 데모 계정을 자동으로 넣는다.

```text
officer@choir.local / choir1234
member@choir.local / choir1234
guest@choir.local / choir1234
```

운영 배포 후에는 반드시 기본 비밀번호를 바꾼다.
