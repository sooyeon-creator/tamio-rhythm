# Tamio Rhythm

6레인 터치 리듬게임. 순수 HTML/CSS/JS + Canvas, PWA로 동작합니다.

## 사용법

1. `index.html`을 정적 서버로 띄웁니다 (예: `npx serve .` 또는 `python3 -m http.server`).
   - `file://`로 바로 열면 서비스워커/일부 API가 막힐 수 있으니 로컬 서버 사용을 권장합니다.
2. 홈 화면에서 영상 파일을 선택합니다.
3. **비트맵 에디터 열기** → 재생을 누르고 박자에 맞춰 6개 레인을 탭합니다.
   - 짧게 탭: Tap 노트
   - 누르고 있기(150ms+): Hold 노트
   - 누른 채로 다른 레인으로 이동: Slide 노트
4. **저장하고 나가기**를 누르면 노트 타이밍이 브라우저에 저장됩니다 (영상 파일 자체는 저장하지 않고, 파일명+크기로 매칭합니다).
5. 같은 영상을 다시 선택하고 **플레이하기**를 누르면 저장된 비트맵으로 플레이할 수 있습니다.

## 특징

- 점수 / 콤보 / 판정(Perfect·Good·Miss) 시스템
- 로컬 최고 기록 저장 (localStorage, 서버 불필요)
- Android Chrome 등 진동 API를 지원하는 브라우저에서 탭/콤보/미스 시 햅틱 피드백
- PWA: 홈 화면에 추가해서 앱처럼 실행 가능

## iOS 등 정교한 햅틱이 필요할 때

브라우저의 `navigator.vibrate`는 iOS Safari에서 동작하지 않습니다. 정교한 Taptic Engine 피드백이 필요하면
이 웹앱을 [Capacitor](https://capacitorjs.com/)로 감싸고 `@capacitor/haptics`를 붙이세요.
`js/haptics.js`의 `fire()` 내부만 교체하면 나머지 게임 로직은 그대로 재사용됩니다.
