'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock, Pause, Play, SkipBack, SkipForward, Square, X } from 'lucide-react'

declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
  }
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

type HistoryItem = { videoId: string; title: string }

export default function Home() {
  const playerRef = useRef<YT.Player | null>(null)
  const apiReadyRef = useRef(false)
  const pendingVideoIdRef = useRef<string | null>(null)
  const currentVideoIdRef = useRef<string | null>(null)
  const resumePositionRef = useRef<number>(0)

  const [url, setUrl] = useState('')
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [playerError, setPlayerError] = useState<number | null>(null)
  const [isHovering, setIsHovering] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('yt-history') || '[]')
      setHistory(saved)
    } catch {}

    try {
      const last = JSON.parse(localStorage.getItem('yt-last-played') || 'null')
      if (last?.videoId && last?.position > 0) {
        resumePositionRef.current = last.position
        pendingVideoIdRef.current = last.videoId
      }
    } catch {}
  }, [])

  useEffect(() => {
    window.onYouTubeIframeAPIReady = () => {
      apiReadyRef.current = true
      if (pendingVideoIdRef.current) {
        initPlayer(pendingVideoIdRef.current)
        pendingVideoIdRef.current = null
      }
    }

    if (document.getElementById('yt-api-script')) {
      if (window.YT?.Player) window.onYouTubeIframeAPIReady()
      return
    }

    const tag = document.createElement('script')
    tag.id = 'yt-api-script'
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  }, [])

  useEffect(() => {
    if (currentVideoId) setUrl(`https://youtu.be/${currentVideoId}`)
  }, [currentVideoId])

  useEffect(() => {
    if (playerError === null) return
    const id = setTimeout(() => setPlayerError(null), 3000)
    return () => clearTimeout(id)
  }, [playerError])

  useEffect(() => {
    if (!isPlaying) return
    const id = setInterval(savePosition, 5000)
    return () => clearInterval(id)
  }, [isPlaying])

  useEffect(() => {
    if (!isPlaying) return
    const id = setInterval(() => {
      const t = playerRef.current?.getCurrentTime()
      if (t !== undefined) setCurrentTime(Math.floor(t))
    }, 1000)
    return () => clearInterval(id)
  }, [isPlaying])

  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  function savePosition() {
    const vid = currentVideoIdRef.current
    const pos = playerRef.current?.getCurrentTime()
    if (vid && pos !== undefined && pos > 0) {
      try {
        localStorage.setItem(
          'yt-last-played',
          JSON.stringify({ videoId: vid, position: Math.floor(pos) })
        )
      } catch {}
    }
  }

  function addToHistory(videoId: string, title: string) {
    setHistory(prev => {
      const filtered = prev.filter(h => h.videoId !== videoId)
      const next = [{ videoId, title }, ...filtered].slice(0, 10)
      try { localStorage.setItem('yt-history', JSON.stringify(next)) } catch {}
      return next
    })
  }

  function initPlayer(videoId: string) {
    currentVideoIdRef.current = videoId
    setCurrentVideoId(videoId)
    const seekTo = resumePositionRef.current
    resumePositionRef.current = 0

    if (playerRef.current) {
      if (seekTo > 0) {
        playerRef.current.loadVideoById(videoId, seekTo)
      } else {
        playerRef.current.loadVideoById(videoId)
      }
      setLoaded(true)
      setIsPlaying(false)
      setBuffering(true)
      setCurrentTime(0)
      setDuration(0)
      return
    }

    playerRef.current = new window.YT.Player('yt-player', {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1, origin: window.location.origin },
      events: {
        onReady: (e: YT.PlayerEvent) => {
          e.target.setVolume(70)
          setLoaded(true)
          setBuffering(true)
          if (seekTo > 0) e.target.seekTo(seekTo, true)
          setDuration(Math.floor(e.target.getDuration()))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(e.target as any).loadModule('captions')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(e.target as any).setOption('captions', 'track', { languageCode: 'ko' })
        },
        onStateChange: (e: YT.OnStateChangeEvent) => {
          const state = e.data
          const playing = state === window.YT.PlayerState.PLAYING
          setIsPlaying(playing)

          if (playing) {
            setPlayerError(null)
            setTimeout(() => setBuffering(false), 1500)
            const vid = currentVideoIdRef.current
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = (playerRef.current as any)?.getVideoData?.()
            if (vid && data?.title) addToHistory(vid, data.title)
            const d = playerRef.current?.getDuration()
            if (d) setDuration(Math.floor(d))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(playerRef.current as any)?.loadModule('captions')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(playerRef.current as any)?.setOption('captions', 'track', { languageCode: 'ko' })
          }

          if (state === window.YT.PlayerState.PAUSED) savePosition()
        },
        onError: (e: YT.OnErrorEvent) => {
          setBuffering(false)
          setLoaded(false)
          setPlayerError(e.data)
          if ([100, 101, 150].includes(e.data)) {
            try { localStorage.removeItem('yt-last-played') } catch {}
          }
        },
      },
    })
  }

  function handleLoad() {
    const videoId = extractVideoId(url)
    if (!videoId) return
    setPlayerError(null)
    resumePositionRef.current = 0
    if (apiReadyRef.current) {
      initPlayer(videoId)
    } else {
      pendingVideoIdRef.current = videoId
    }
  }

  function handlePlayPause() {
    if (!playerRef.current) return
    if (isPlaying) {
      playerRef.current.pauseVideo()
    } else {
      playerRef.current.playVideo()
    }
  }

  function handleStop() {
    if (!playerRef.current) return
    savePosition()
    playerRef.current.stopVideo()
    setIsPlaying(false)
  }

  function loadFromHistory(item: HistoryItem) {
    setUrl(`https://youtu.be/${item.videoId}`)
    setShowHistory(false)
    resumePositionRef.current = 0
    if (apiReadyRef.current) {
      initPlayer(item.videoId)
    } else {
      pendingVideoIdRef.current = item.videoId
    }
  }

  function handlePrev() {
    const idx = history.findIndex(h => h.videoId === currentVideoId)
    if (idx >= 0 && idx < history.length - 1) loadFromHistory(history[idx + 1])
  }

  function handleNext() {
    const idx = history.findIndex(h => h.videoId === currentVideoId)
    if (idx > 0) loadFromHistory(history[idx - 1])
  }

  const currentIdx = currentVideoId ? history.findIndex(h => h.videoId === currentVideoId) : -1
  const canPrev = currentIdx >= 0 && currentIdx < history.length - 1
  const canNext = currentIdx > 0
  const showControls = !isPlaying || isHovering

  return (
    <div
      className="app-drag relative flex flex-col h-screen overflow-hidden bg-zinc-950 text-zinc-100 select-none"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* 시청 기록 패널 - 전체 화면 커버 */}
      {showHistory && (
        <div className="absolute inset-0 z-30 bg-zinc-900 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
            <span className="text-xs font-medium text-zinc-400">최근 시청</span>
            <button
              onClick={() => setShowHistory(false)}
              className="app-no-drag text-zinc-500 hover:text-zinc-200 transition-colors"
              aria-label="닫기"
            >
              <X size={13} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto app-no-drag">
            {history.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-zinc-600 text-xs">기록 없음</span>
              </div>
            ) : (
              history.map((item, i) => (
                <button
                  key={item.videoId}
                  onClick={() => loadFromHistory(item)}
                  className="app-no-drag w-full text-left px-3 py-2 hover:bg-zinc-800 transition-colors flex items-start gap-2"
                >
                  <span className="text-zinc-600 text-xs shrink-0 w-4 mt-0.5">{i + 1}.</span>
                  <span className="text-zinc-300 text-xs line-clamp-2 leading-tight">{item.title}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* 영상 영역 */}
      <div className="app-no-drag relative flex-1 min-h-0 bg-black">
        <div id="yt-player" className="absolute inset-0" />
        <div className={`absolute inset-0 z-10 ${buffering ? 'bg-black' : ''}`} />

        {/* 플레이스홀더 / 에러 */}
        {!loaded && playerError === null && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <span className="text-zinc-600 text-xs">URL을 입력하고 Enter</span>
          </div>
        )}
        {playerError !== null && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <span className="text-red-500 text-xs">
              {playerError === 100 && '영상을 찾을 수 없습니다 (비공개 또는 삭제됨)'}
              {(playerError === 101 || playerError === 150) && '이 영상은 외부 재생이 차단되어 있습니다'}
              {playerError === 5 && '재생 오류 (HTML5 플레이어)'}
              {![100, 101, 150, 5].includes(playerError) && `재생 불가 (오류 코드: ${playerError})`}
            </span>
          </div>
        )}

        {/* 닫기 버튼 */}
        <div className={`absolute top-2 left-2 z-50 transition-opacity duration-200 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <button
            onClick={() => window.close()}
            className="app-no-drag text-zinc-400 hover:text-white transition-colors"
            aria-label="닫기"
          >
            <X size={14} />
          </button>
        </div>

        {/* 현재 재생 시간 */}
        {loaded && (
          <div className="absolute top-2 right-2 z-50 text-zinc-300 text-xs font-mono tabular-nums pointer-events-none">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        )}
      </div>

      {/* 컨트롤 영역 */}
      <div className={`shrink-0 bg-zinc-900 px-2 py-2 space-y-1.5 transition-opacity duration-200 ${
        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
          onFocus={(e) => e.target.select()}
          placeholder="YouTube URL 입력 후 Enter"
          className="app-no-drag w-full bg-zinc-800 text-zinc-100 text-xs px-3 py-1.5 rounded placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-600"
        />
        <div className="flex items-center">
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrev}
              disabled={!canPrev}
              className={`app-no-drag transition-colors shrink-0 ${canPrev ? 'text-zinc-300 hover:text-white' : 'text-zinc-600'}`}
              aria-label="이전 영상"
            >
              <SkipBack size={16} />
            </button>
            <button
              onClick={handlePlayPause}
              className="app-no-drag text-zinc-300 hover:text-white transition-colors shrink-0"
              aria-label={isPlaying ? '일시정지' : '재생'}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              onClick={handleStop}
              className="app-no-drag text-zinc-300 hover:text-white transition-colors shrink-0"
              aria-label="정지"
            >
              <Square size={16} />
            </button>
            <button
              onClick={handleNext}
              disabled={!canNext}
              className={`app-no-drag transition-colors shrink-0 ${canNext ? 'text-zinc-300 hover:text-white' : 'text-zinc-600'}`}
              aria-label="이후 영상"
            >
              <SkipForward size={16} />
            </button>
          </div>
          <div className="flex-1 flex justify-end">
            <button
              onClick={() => setShowHistory(h => !h)}
              className={`app-no-drag transition-colors shrink-0 ${showHistory ? 'text-white' : 'text-zinc-400 hover:text-white'}`}
              aria-label="시청 기록"
            >
              <Clock size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
