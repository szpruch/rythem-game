import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

const ytCallbacks = []
let ytLoading = false

function whenYTReady(cb) {
  if (window.YT && window.YT.Player) { cb(); return }
  ytCallbacks.push(cb)
  if (!ytLoading) {
    ytLoading = true
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
    window.onYouTubeIframeAPIReady = () => {
      ytCallbacks.forEach(fn => fn())
      ytCallbacks.length = 0
    }
  }
}

const YouTubePlayer = forwardRef(function YouTubePlayer({ videoId, onPlayStateChange }, ref) {
  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const timerRef = useRef(null)
  const readyRef = useRef(false)
  const pendingDurationRef = useRef(null)
  const currentVideoIdRef = useRef(videoId)

  useImperativeHandle(ref, () => ({
    playForSeconds(seconds) {
      if (!playerRef.current || !readyRef.current) return
      clearTimeout(timerRef.current)
      pendingDurationRef.current = seconds
      playerRef.current.seekTo(0)
      playerRef.current.playVideo()
    },
    play() {
      if (!playerRef.current || !readyRef.current) return
      clearTimeout(timerRef.current)
      pendingDurationRef.current = null
      playerRef.current.playVideo()
    },
    playFromStart() {
      if (!playerRef.current || !readyRef.current) return
      clearTimeout(timerRef.current)
      pendingDurationRef.current = null
      playerRef.current.seekTo(0)
      playerRef.current.playVideo()
    },
    pause() {
      clearTimeout(timerRef.current)
      pendingDurationRef.current = null
      playerRef.current?.pauseVideo()
    },
  }))

  // Create player once — iOS audio lock persists as long as iframe stays mounted
  useEffect(() => {
    let destroyed = false
    whenYTReady(() => {
      if (destroyed || !containerRef.current) return
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: currentVideoIdRef.current,
        width: 1,
        height: 1,
        playerVars: { controls: 0, disablekb: 1, rel: 0, iv_load_policy: 3, playsinline: 1 },
        events: {
          onReady: () => { if (!destroyed) readyRef.current = true },
          onStateChange: (e) => {
            if (destroyed || !window.YT) return
            const playing = e.data === window.YT.PlayerState.PLAYING
            onPlayStateChange?.(playing)
            if (playing && pendingDurationRef.current !== null) {
              const secs = pendingDurationRef.current
              pendingDurationRef.current = null
              clearTimeout(timerRef.current)
              timerRef.current = setTimeout(() => playerRef.current?.pauseVideo(), secs * 1000)
            }
          },
        },
      })
    })
    return () => {
      destroyed = true
      clearTimeout(timerRef.current)
      playerRef.current?.destroy()
      playerRef.current = null
      readyRef.current = false
      pendingDurationRef.current = null
    }
  }, [])

  // Cue new video without recreating the iframe (keeps iOS audio unlocked)
  useEffect(() => {
    currentVideoIdRef.current = videoId
    if (playerRef.current && readyRef.current && videoId) {
      clearTimeout(timerRef.current)
      pendingDurationRef.current = null
      playerRef.current.cueVideoById(videoId)
    }
  }, [videoId])

  return <div ref={containerRef} style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: 1, height: 1 }} />
})

export default YouTubePlayer
