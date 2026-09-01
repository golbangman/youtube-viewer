# YouTube Viewer

## Definition

작업 중 화면 오른쪽 하단에 항상 떠 있는 소형 데스크탑 YouTube 뷰어로, 개발자가 다른 작업을 방해받지 않고 YouTube를 틀어놓을 수 있게 한다.

## Users and situations

사용자 본인(개발자). 코딩 등 주 작업을 하면서 YouTube를 배경으로 틀어두고 싶을 때.

## Problem and current alternatives

브라우저에서 YouTube를 전체 탭으로 열면 화면을 많이 차지하고, 다른 창으로 전환할 때마다 뷰어가 가려진다.

## Promised change

YouTube를 별도 창 관리 없이 화면 한 귀퉁이에 계속 켜두면서 작업에 집중할 수 있다.

## Core loop

1. 앱을 실행하면 화면 오른쪽 하단에 소형 창이 뜬다.
2. YouTube URL을 입력한다.
3. 영상이 재생된다.
4. 작업 도중 재생/정지/스탑, 볼륨 조정을 한다.
5. 다른 창이 앞으로 와도 뷰어는 always-on-top으로 유지된다.

## Capabilities and boundaries

- YouTube URL을 받아 영상을 재생한다.
- 재생, 정지, 스탑, 볼륨 조정 컨트롤을 제공한다.
- 화면 오른쪽 하단에 고정된 소형 창으로 동작한다.
- always-on-top으로 다른 창 뒤로 숨지 않는다.
- YouTube 검색 기능은 제공하지 않는다. URL 입력이 유일한 진입점이다.

## Experience principles

- 뷰어가 작업 화면을 최소한으로 침범한다.
- 컨트롤은 영상 위에 있어야 하지만 시청을 방해하지 않는다.
- 인터랙션은 단순하고 즉각적이다.

## Success signals

- URL을 붙여넣고 재생까지 클릭 한 번으로 완료된다.
- 다른 앱을 최대화해도 뷰어가 화면에 남아 있다.
- 작업 중 뷰어를 닫거나 다시 띄우려는 행동이 생기지 않는다.

## Assumptions and unknowns

- Assumption: 배포 타깃 없음. 사용자 본인의 머신에서만 실행한다.
- Assumption: 창 크기는 고정형 소형으로 설계한다.
- Unknown: 창 드래그 이동 지원 여부 — 지금은 결정하지 않는다.
