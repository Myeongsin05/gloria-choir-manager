# Gloria Choir Manager

찬양대의 주간곡, 악보 파일, 찬양집, 찬양 이력, 역할별 권한을 한곳에서 관리하기 위한 웹 기반 찬양대 운영 시스템입니다.

현재 버전은 **Node.js + Express 기반 로컬/서버 배포용 MVP**입니다. 로그인 세션, JSON 데이터 저장, 악보 파일 업로드, Docker 배포 구성을 포함합니다.

## 주요 기능

### 주간곡 관리

- 이번 주 찬양곡 등록
- 예배/행사, 곡명, 파트, 미리듣기 링크 관리
- 접근 권한 표시
- 곡명/내용 검색

### 악보 파일 관리

- PDF, JPG, PNG 악보 업로드
- 업로드 파일을 `uploads/` 폴더에 저장
- 악보 파일과 곡 정보 연결

### 찬양집 관리

- 찬양집 등록
- 보유 수량 및 재고 조정
- 수록곡 검색
- CSV 내보내기

### 찬양 이력 관리

- 찬양곡 사용 이력 등록
- 이력 검색
- 곡별 사용 빈도 통계

### 권한/운영 관리

- 지휘자, 임원, 찬양대원 역할 전환
- 역할별 권한 매트릭스
- 활동 로그
- 로컬 세션 쿠키 기반 로그인

## 기술 스택

- Node.js
- Express
- Multer
- HTML/CSS/Vanilla JavaScript
- JSON file storage
- Docker / Docker Compose

## 프로젝트 구조

```text
gloria-choir-manager/
├─ index.html
├─ forgot-password.html
├─ styles.css
├─ app.js
├─ forgot-password.js
├─ server.js
├─ package.json
├─ Dockerfile
├─ docker-compose.yml
├─ vercel.json
├─ data/
├─ uploads/
└─ docs/
```

## 로컬 실행

### 1. 저장소 받기

```powershell
git clone https://github.com/Myeongsin05/gloria-choir-manager.git
cd gloria-choir-manager
```

### 2. 패키지 설치

```powershell
npm install
```

### 3. 실행

```powershell
npm start
```

브라우저에서 아래 주소를 엽니다.

```text
http://localhost:3000
```

## 기본 데모 계정

```text
지휘자: director@choir.local / choir1234
임원:   officer@choir.local  / choir1234
대원:   member@choir.local   / choir1234
게스트: guest@choir.local    / choir1234
```

운영 배포 후에는 기본 비밀번호를 반드시 변경하세요.

## 점검 명령

```powershell
npm run check
```

`app.js`, `server.js` 문법을 확인합니다.

## Docker 실행

```bash
docker compose up -d --build
```

로그 확인:

```bash
docker logs -f choir-asset-system
```

중지:

```bash
docker compose down
```

## 서버 배포

서버 배포는 Docker Compose 방식을 권장합니다.

기본 흐름:

```bash
mkdir -p ~/apps
cd ~/apps
git clone https://github.com/Myeongsin05/gloria-choir-manager.git choir-asset-system
cd choir-asset-system
docker compose up -d --build
```

서버 내부 테스트:

```bash
curl http://localhost:3000
```

브라우저 접속 예:

```text
http://서버주소:3000
```

실제 서버 주소, SSH 계정, 방화벽 규칙, 운영 비밀번호 같은 정보는 공개 저장소에 올리지 말고 개인 배포 문서나 안전한 비밀 관리 도구에 따로 보관하세요.

## 데이터 보존

Docker 배포 시 아래 경로는 컨테이너 밖에 유지됩니다.

```text
data/
uploads/
```

운영 데이터 예:

```text
data/store.json
data/users.json
data/mail-outbox.json
uploads/
```

업데이트나 컨테이너 재빌드 전에는 `data/`, `uploads/`를 백업해두는 것을 권장합니다.

## 현재 한계

- JSON 파일 기반 저장소이므로 대규모 동시 편집에는 적합하지 않습니다.
- 운영 공개 전 기본 계정/비밀번호 변경이 필요합니다.
- 외부 인터넷 공개 시 HTTPS, 도메인, 방화벽, 백업 정책을 별도로 구성해야 합니다.
- 메일 발송은 실제 SMTP 연동 전까지 로컬 outbox 방식으로 다룰 수 있습니다.

## 다음 개선 후보

- 비밀번호 해시 저장 및 재설정 플로우 고도화
- 모바일/PWA 오프라인 동기화
- Excel 가져오기
- 악보 버전 이력
- 권한 변경 이력
- DB 기반 저장소 전환
- 자동 백업

## 라이선스

현재 라이선스는 지정되어 있지 않습니다.
