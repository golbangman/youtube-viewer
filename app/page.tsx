'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Square, Volume2 } from 'lucide-react'

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

export default function Home() {
  const playerRef = useRef<YT.Player | null>(null)
  const apiReadyRef = useRef(false)
  const pendingVideoIdRef = useRef<string | null>(null)

  const [url, setUrl] = useState('')
  const [volume, setVolume] = useState(70)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [buffering, setBuffering] = useState(false)

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

  function initPlayer(videoId: string) {
    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId)
      setLoaded(true)
      setIsPlaying(false)
      setBuffering(true)
      return
    }

    playerRef.current = new window.YT.Player('yt-player', {
      videoId,
      playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1 },
      events: {
        onReady: (e: YT.PlayerEvent) => {
          e.target.setVolume(volume)
          setLoaded(true)
          setBuffering(true)
        },
        onStateChange: (e: YT.OnStateChangeEvent) => {
          const playing = e.data === window.YT.PlayerState.PLAYING
          setIsPlaying(playing)
          if (playing) setBuffering(false)
        },
      },
    })
  }

  function handleLoad() {
    const videoId = extractVideoId(url)
    if (!videoId) return

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
    playerRef.current.stopVideo()
    setIsPlaying(false)
  }

  function handleVolume(v: number) {
    setVolume(v)
    playerRef.current?.setVolume(v)
  }

  return (
    <div className="app-drag flex flex-col h-screen bg-zinc-950 text-zinc-100 select-none overflow-hidden">
      {/* 영상 영역 */}
      <div className="relative flex-1 bg-black min-h-0">
        <div id="yt-player" className="app-no-drag w-full h-full" />
        {/* 마우스 OSD 차단 + 영상 시작 초기 OSD 차단 */}
        <div className={`absolute inset-0 ${buffering ? 'bg-black' : ''}`} />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-zinc-600 text-xs">URL을 입력하고 Enter</span>
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
      </div>
    </div>
  )
}
