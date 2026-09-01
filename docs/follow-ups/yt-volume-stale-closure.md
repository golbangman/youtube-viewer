# YT 플레이어 초기 볼륨 스테일 클로저

`initPlayer`가 `onYouTubeIframeAPIReady` 콜백 등록 시점의 `volume` 값을 캡처하므로, API 로드 전에 사용자가 볼륨을 바꿔도 `onReady`에서 적용되는 값은 최초 렌더 값(70)이다.

실용적 영향: 영상이 로드된 뒤 슬라이더로 조절하면 즉시 반영되므로 일반 사용에서는 무해하다.

수정 방향: `initPlayer`를 `useCallback`으로 감싸고 `volume`을 의존성에 추가하거나, `onReady`에서 `playerRef.current`를 통해 최신 값을 읽도록 변경한다.
