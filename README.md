# 찬양대 악보 및 자산 관리 시스템

요구사항 정의서와 유저 플로우를 바탕으로 만든 로컬 웹 MVP입니다. Express 서버가 화면, 로그인 세션, JSON 데이터 저장, 악보 파일 업로드를 처리합니다.

## 현재 구현 범위

- 역할 전환: 지휘자, 임원, 찬양대원
- 로그인 화면과 로컬 세션 쿠키
- 이번 주 찬양곡 등록, 검색, 파트 분류, 미리 듣기 링크, 접근 권한 표시
- PDF/JPG/PNG 악보 파일 업로드 및 `uploads/` 저장
- 찬양집 등록, 재고 조정, 수록곡 검색, CSV 내보내기
- 찬양 이력 등록, 검색, 빈도 통계
- 역할별 권한 매트릭스와 활동 로그
- `data/store.json` 기반 로컬 데이터 저장

## 실행

```powershell
npm.cmd install
npm.cmd start
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 데모 계정

- 지휘자: `director@choir.local` / `choir1234`
- 임원: `officer@choir.local` / `choir1234`
- 대원: `member@choir.local` / `choir1234`

## 다음 작업 후보

- 비밀번호 해시 저장과 비밀번호 재설정 구현
- 모바일 앱 또는 PWA 오프라인 동기화 구현
- Excel 가져오기, 악보 버전 이력, 권한 변경 이력 고도화
