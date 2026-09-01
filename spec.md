# YouTube Viewer — Spec

## Goal

화면 오른쪽 하단에 고정된 소형 데스크탑 YouTube 뷰어.
다른 작업을 하는 도중에도 always-on-top으로 영상이 유지된다.

## Acceptance criteria

1. `bun run electron:dev` 명령으로 앱이 실행된다.
2. Electron 창이 화면 오른쪽 하단 모서리에 나타나고 `alwaysOnTop`이 활성화되어 있다.
3. YouTube URL을 붙여넣고 Enter를 누르면 영상이 재생된다.
4. 재생/정지 토글 버튼이 동작한다.
5. 스탑 버튼을 누르면 영상이 처음으로 돌아가며 멈춘다.
6. 볼륨 슬라이더로 소리를 조절할 수 있다.

## Out of scope

- YouTube 검색 (URL 입력만 지원)
- 창 크기 조절
- 재생목록·이어보기·히스토리
- 프로덕션 빌드 및 패키징
