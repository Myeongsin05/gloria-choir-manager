# Gloria Choir Manager

찬양곡 선정부터 악보 공유, 찬양집 재고와 사용 이력까지 찬양대 운영에 필요한 정보를 한곳에서 관리하는 웹 애플리케이션입니다.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Deploy](https://img.shields.io/badge/Vercel-Live-000000?logo=vercel&logoColor=white)](https://choir-asset-system.vercel.app/)

> 현재 버전은 Node.js와 Express로 구현한 MVP입니다. 로컬 JSON 저장소와 Supabase 기반 클라우드 저장소를 지원합니다.

**[배포된 서비스 바로가기](https://choir-asset-system.vercel.app/)** · [로컬 실행](#로컬-실행) · [배포 방법](#배포)

## 프로젝트 소개

주간 찬양곡, 악보 파일, 찬양집과 사용 이력이 여러 문서와 대화방에 흩어지는 문제를 줄이기 위해 만들었습니다. 임원은 운영 자료를 등록하고 관리할 수 있고, 찬양대원은 필요한 곡과 이력을 빠르게 확인할 수 있습니다.

## 핵심 기능

- **주간 찬양 준비** — 예배·행사별 찬양곡, 파트, 찬양집 페이지와 미리듣기 링크를 관리합니다.
- **악보 공유** — PDF·JPG·PNG 악보를 업로드하고 곡 정보와 연결합니다.
- **찬양집 관리** — 보유 수량과 수록곡을 관리하고 데이터를 CSV로 내보냅니다.
- **사용 이력 확인** — 찬양곡 사용 이력을 검색하고 곡별 사용 빈도를 확인합니다.
- **사용자 및 권한 관리** — 사용자 역할을 지정하고 역할별 접근 권한과 활동 로그를 관리합니다.

## 역할별 권한

| 기능 | 임원 | 우리 찬양대원 | 타 찬양대원 |
| --- | :---: | :---: | :---: |
| 주간곡 확인 | O | O | 공개 정보만 |
| 악보 관리 | O | - | - |
| 찬양집 관리 | O | - | - |
| 찬양 이력 확인 | O | O | - |
| 찬양 이력 관리 | O | - | - |
| 사용자·권한 관리 | O | - | - |

역할별 세부 권한은 임원 계정의 권한 관리 화면에서 조정할 수 있습니다.

## 기술 스택

- **Backend:** Node.js, Express, Multer
- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Storage:** 로컬 JSON 파일 또는 Supabase Database·Storage
- **Deployment:** Vercel, Docker, Docker Compose

## 실행 방식

| 용도 | 실행 환경 | 데이터 저장소 | 악보 파일 저장소 |
| --- | --- | --- | --- |
| 개발·테스트 | 로컬 Node.js | `data/*.json` | `uploads/` |
| 자체 서버 운영 | Docker Compose | 로컬 볼륨 | 로컬 볼륨 |
| 클라우드 운영 | Vercel | Supabase | Supabase Storage |

Supabase 환경변수가 설정되면 클라우드 저장소를 사용하고, 설정되지 않으면 로컬 파일 저장소를 사용합니다.

## 로컬 실행

### 요구 사항

- Node.js 18 이상
- npm

### 설치 및 실행

```bash
git clone https://github.com/Myeongsin05/gloria-choir-manager.git
cd gloria-choir-manager
npm install
npm start
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

### 데모 계정

| 역할 | 이메일 | 비밀번호 |
| --- | --- | --- |
| 임원 | `officer@choir.local` | `choir1234` |
| 우리 찬양대원 | `member@choir.local` | `choir1234` |
| 타 찬양대원 | `guest@choir.local` | `choir1234` |

> [!WARNING]
> 위 계정은 개발·테스트용입니다. 인터넷에 서비스를 공개하기 전에 기본 계정과 비밀번호를 변경하고 별도의 `SESSION_SECRET`을 설정하세요.

## 환경변수

| 변수 | 필요 조건 | 설명 |
| --- | --- | --- |
| `PORT` | 선택 | 로컬 서버 포트, 기본값은 `3000` |
| `SESSION_SECRET` | 운영 환경 필수 | 로그인 세션 서명에 사용하는 긴 임의 문자열 |
| `SUPABASE_URL` | Supabase 사용 시 필수 | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 사용 시 필수 | 서버에서만 사용하는 Supabase 비밀키 |
| `SUPABASE_STORAGE_BUCKET` | 선택 | 악보 파일 버킷, 기본값은 `score-files` |

`.env` 파일과 비밀키는 Git 저장소에 커밋하지 마세요. `SUPABASE_SERVICE_ROLE_KEY`는 브라우저 코드에 노출해서는 안 됩니다.

## 점검

```bash
npm run check
```

`app.js`와 `server.js`의 JavaScript 문법을 검사합니다.

## 배포

### Vercel + Supabase

현재 서비스는 다음 주소에 배포되어 있습니다.

- **서비스:** [https://choir-asset-system.vercel.app/](https://choir-asset-system.vercel.app/)

새 환경에 배포하려면 Supabase 프로젝트와 Storage 버킷을 준비한 후 Vercel에 환경변수를 등록해야 합니다. 자세한 절차는 [SUPABASE_VERCEL_SETUP.md](SUPABASE_VERCEL_SETUP.md)를 참고하세요.

### Docker Compose

```bash
docker compose up -d --build
```

로그 확인과 종료:

```bash
docker logs -f choir-asset-system
docker compose down
```

Docker 배포에서는 `data/`와 `uploads/`가 컨테이너 밖에 유지됩니다. 업데이트나 재빌드 전 두 경로를 백업하는 것을 권장합니다.

## 프로젝트 구조

```text
gloria-choir-manager/
├─ index.html                 # 메인 화면
├─ app.js                     # 프런트엔드 동작
├─ styles.css                 # 화면 스타일
├─ forgot-password.html       # 비밀번호 찾기 화면
├─ forgot-password.js
├─ server.js                  # Express 서버와 API
├─ data/                      # 로컬 JSON 데이터
├─ uploads/                   # 로컬 악보 파일
├─ db/schema.sql              # DB 전환용 스키마
├─ supabase-schema.sql        # Supabase 스키마
├─ docs/                      # 설계 문서
├─ Dockerfile
├─ docker-compose.yml
└─ vercel.json
```

데이터베이스 구조는 [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md), [db/schema.sql](db/schema.sql), [supabase-schema.sql](supabase-schema.sql)에서 확인할 수 있습니다.

## 데이터와 보안

- 로컬 데이터는 `data/`, 업로드한 악보는 `uploads/`에 저장됩니다.
- JSON 저장소는 소규모 운영과 MVP 검증에 적합하며 대규모 동시 편집에는 적합하지 않습니다.
- 외부 공개 시 HTTPS, 접근 권한, 방화벽과 정기 백업 정책을 별도로 관리하세요.
- 현재 데모 계정 비밀번호는 평문 기반이므로 실제 운영 전 인증 구조를 강화해야 합니다.
- 메일 발송은 SMTP 연동 전까지 로컬 outbox 방식으로 처리됩니다.

## 로드맵

- [x] 주간곡과 악보 관리
- [x] 찬양집 재고와 수록곡 관리
- [x] 찬양 이력과 사용 빈도 확인
- [x] 역할별 접근 권한
- [x] Docker 배포
- [x] Supabase와 Vercel 연동
- [ ] 비밀번호 해시 저장과 재설정 기능 강화
- [ ] Excel 데이터 가져오기
- [ ] 악보 버전 이력
- [ ] 권한 변경 이력
- [ ] 자동 백업
- [ ] 모바일·PWA 오프라인 동기화

## 라이선스

현재 별도의 오픈소스 라이선스가 지정되어 있지 않습니다.
