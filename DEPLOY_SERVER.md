# aiteam.chanuk.theworkpc.com 서버 배포 안내

이 앱은 Node.js + Express 앱입니다. Vercel 배포본을 그대로 복사하는 것이 아니라, 서버에서 `server.js`를 실행하고 도메인을 이 앱 포트로 연결해야 합니다.

## 1. 서버에서 필요한 것

- Node.js 18 이상
- npm
- 웹 서버 프록시: Nginx, Apache, 또는 관리 패널의 reverse proxy 기능
- 앱 실행 포트: 기본 `3000`

## 2. 웹 관리 화면에서 배포하는 경우

`https://aiteam.chanuk.theworkpc.com/`에 접속했을 때 관리 패널이 있다면 보통 다음 중 하나입니다.

- 파일 관리자 + 터미널
- Docker / Portainer
- Node.js 앱 배포 메뉴
- Git 배포 메뉴

### A. 파일 관리자 + 터미널 방식

1. 이 프로젝트 폴더를 zip으로 압축해서 서버에 업로드합니다.
2. 서버에서 압축을 풉니다.
3. 터미널에서 프로젝트 폴더로 이동합니다.
4. 아래 명령을 실행합니다.

```bash
npm install
npm start
```

앱은 기본적으로 `http://서버내부주소:3000`에서 실행됩니다.

### B. Docker / Portainer 방식

1. 프로젝트 파일을 서버에 업로드합니다.
2. Docker build를 실행합니다.

```bash
docker build -t choir-asset-system .
docker run -d --name choir-asset-system -p 3000:3000 choir-asset-system
```

3. 관리 패널에서 `aiteam.chanuk.theworkpc.com`을 컨테이너의 `3000` 포트로 reverse proxy 연결합니다.

## 3. Nginx reverse proxy 예시

서버에서 앱이 `localhost:3000`으로 실행 중이라면:

```nginx
server {
    server_name aiteam.chanuk.theworkpc.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 4. 현재 저장 방식 주의

현재 데이터는 서버 파일에 저장됩니다.

- `data/users.json`
- `data/store.json`
- `data/mail-outbox.json`
- `uploads/`

운영 서버에서는 이 폴더들이 지워지지 않도록 백업하거나, 다음 단계에서 Supabase/PostgreSQL/S3 같은 영구 저장소로 옮기는 것이 좋습니다.

## 5. 접속 확인

배포 후 브라우저에서 접속합니다.

```text
https://aiteam.chanuk.theworkpc.com/
```

데모 계정:

```text
director@choir.local / choir1234
officer@choir.local / choir1234
member@choir.local / choir1234
guest@choir.local / choir1234
```
