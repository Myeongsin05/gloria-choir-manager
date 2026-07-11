# n100 서버 배포 안내

이 프로젝트는 Node.js + Express 앱이며, Docker 컨테이너로 배포하는 방식을 권장한다.

## 1. 전체 구조

```text
내 PC
  -> n100 서버
      -> Docker container
          -> choir-asset-system 앱
```

`ms` 계정에 sudo 권한을 부여했다면, 앞으로는 root 대신 `ms` 계정으로 접속해서 배포하면 된다.

```bash
ssh ms@aiteam.chanuk.theworkpc.com
```

## 2. n100 서버에 필요한 것

서버에 Docker가 설치되어 있어야 한다.

```bash
docker --version
docker compose version
```

Docker가 없다면 Debian 기준으로 root 또는 sudo 권한 계정에서 설치한다.

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
```

`ms` 계정으로 Docker를 sudo 없이 쓰고 싶다면:

```bash
sudo usermod -aG docker ms
```

그 후 반드시 로그아웃 후 다시 접속한다.

## 3. 프로젝트 파일 서버로 올리기

### 방법 A. Git을 쓰는 경우

서버에서 프로젝트를 받을 위치로 이동한다.

```bash
mkdir -p ~/apps
cd ~/apps
```

Git 저장소가 있다면 clone 한다.

```bash
git clone <저장소_URL> choir-asset-system
cd choir-asset-system
```

이미 받아둔 폴더가 있다면:

```bash
cd ~/apps/choir-asset-system
git pull
```

### 방법 B. zip/scp로 올리는 경우

내 PC에서 압축 파일을 서버로 복사한다.

```bash
scp gloria-choir-manager-github-upload.zip ms@aiteam.chanuk.theworkpc.com:~/apps/
```

서버에서 압축을 푼다.

```bash
cd ~/apps
unzip gloria-choir-manager-github-upload.zip -d choir-asset-system
cd choir-asset-system
```

## 4. 컨테이너 실행

프로젝트 폴더에서 실행한다.

```bash
docker compose up -d --build
```

정상 실행 확인:

```bash
docker ps
docker logs -f choir-asset-system
```

서버 내부에서 접속 테스트:

```bash
curl http://localhost:3000
```

브라우저에서는 아래 주소로 접속한다.

```text
http://aiteam.chanuk.theworkpc.com:3000
```

## 5. 데이터 유지

`docker-compose.yml`에서 아래 폴더를 컨테이너 밖에 유지한다.

```text
./data:/app/data
./uploads:/app/uploads
```

따라서 컨테이너를 재시작하거나 새로 빌드해도 다음 데이터는 서버 폴더에 남는다.

```text
data/store.json
data/users.json
data/mail-outbox.json
uploads/
```

## 6. 업데이트 배포

새 코드가 서버에 올라온 뒤 프로젝트 폴더에서 실행한다.

```bash
docker compose up -d --build
```

불필요한 이전 이미지를 정리하려면:

```bash
docker image prune
```

## 7. 중지/재시작

```bash
docker compose restart
docker compose down
docker compose up -d
```

## 8. 기본 로그인 계정

```text
director@choir.local / choir1234
officer@choir.local / choir1234
member@choir.local / choir1234
guest@choir.local / choir1234
```

운영 배포 후에는 반드시 기본 비밀번호를 변경해야 한다.
