'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock, Pause, Play, Square, Volume2, X } from 'lucide-react'

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
  const [volume, setVolume] = useState(70)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [playerError, setPlayerError] = useState(false)

  // 히스토리 + 마지막 재생 위치 복원
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

  // YouTube IFrame API 로드
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

  // 재생 중 5초마다 위치 저장
  useEffect(() => {
    if (!isPlaying) return
    const id = setInterval(savePosition, 5000)
    return () => clearInterval(id)
  }, [isPlaying])

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
    const seekTo = resumePositionRef.current
    resumePositionRef.current = 0

    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId, seekTo)
      setLoaded(true)
      setIsPlaying(false)
      setBuffering(true)
      return
    }

    playerRef.current = new window.YT.Player('yt-player', {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1 },
      events: {
        onReady: (e: YT.PlayerEvent) => {
          e.target.setVolume(volume)
          setLoaded(true)
          setBuffering(true)
          if (seekTo > 0) e.target.seekTo(seekTo, true)
        },
        onStateChange: (e: YT.OnStateChangeEvent) => {
          const state = e.data
          const playing = state === window.YT.PlayerState.PLAYING
          setIsPlaying(playing)

          if (playing) {
            setPlayerError(false)
            setTimeout(() => setBuffering(false), 1500)
            const vid = currentVideoIdRef.current
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = (playerRef.current as any)?.getVideoData?.()
            if (vid && data?.title) addToHistory(vid, data.title)
          }

          if (state === window.YT.PlayerState.PAUSED) savePosition()
        },
        onError: () => {
          setPlayerError(true)
          setBuffering(false)
          setLoaded(false)
        },
      },
    })
  }

  function handleLoad() {
    const videoId = extractVideoId(url)
    if (!videoId) return
    setShowHistory(false)
    setPlayerError(false)
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

  function handleVolume(v: number) {
    setVolume(v)
    playerRef.current?.setVolume(v)
  }

  function loadFromHistory(item: HistoryItem) {
    setUrl(`https://youtu.be/${item.videoId}`)
    setShowHistory(false)
    resumePositionRef.current = 0  // 히스토리에서 로드 시 처음부터
    if (apiReadyRef.current) {
      initPlayer(item.videoId)
    } else {
      pendingVideoIdRef.current = item.videoId
    }
  }

  return (
    <div className="app-drag flex flex-col h-screen bg-zinc-950 text-zinc-100 select-none overflow-hidden">
      {/* 영상 영역 */}
      <div className="relative flex-1 bg-black min-h-0">
        <div id="yt-player" className="app-no-drag absolute inset-0" />
        <div className={`absolute inset-0 z-10 ${buffering ? 'bg-black' : ''}`} />
        {!loaded && !playerError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <span className="text-zinc-600 text-xs">URL을 입력하고 Enter</span>
          </div>
        )}
        {playerError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <span className="text-red-500 text-xs">재생 불가 (임베드 제한 또는 오류)</span>
          </div>
        )}

        {/* 시청 기록 패널 */}
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
      </div>

      {/* URL 입력 */}
      <div className="px-2 pt-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
          onFocus={(e) => e.target.select()}
          placeholder="YouTube URL 입력 후 Enter"
          className="app-no-drag w-full bg-zinc-800 text-zinc-100 text-xs px-3 py-1.5 rounded placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-600"
        />
      </div>

      {/* 컨트롤 */}
      <div className="flex items-center gap-2 px-2 py-2">
        <button
          onClick={handlePlayPause}
          className="app-no-drag text-zinc-400 hover:text-zinc-100 transition-colors shrink-0"
          aria-label={isPlaying ? '정지' : '재생'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <button
          onClick={handleStop}
          className="app-no-drag text-zinc-400 hover:text-zinc-100 transition-colors shrink-0"
          aria-label="스탑"
        >
          <Square size={16} />
        </button>

        <Volume2 size={14} className="text-zinc-600 shrink-0" />

        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => handleVolume(Number(e.target.value))}
          className="app-no-drag flex-1 accent-red-600 h-1 cursor-pointer"
          aria-label="볼륨"
        />

        <button
          onClick={() => setShowHistory(h => !h)}
          className={`app-no-drag transition-colors shrink-0 ${showHistory ? 'text-zinc-100' : 'text-zinc-400 hover:text-zinc-100'}`}
          aria-label="시청 기록"
        >
          <Clock size={14} />
        </button>
      </div>
    </div>
  )
}
