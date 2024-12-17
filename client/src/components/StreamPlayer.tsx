import { useState, useCallback } from 'react';
import ReactPlayer from 'react-player';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Maximize, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';

interface StreamPlayerProps {
  url: string;
  title?: string;
  videoTracks?: Array<{
    width?: number;
    height?: number;
    bitrate?: number;
  }>;
}

interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';
  lastUpdate: Date;
  errorCount: number;
  message?: string;
}

export default function StreamPlayer({ url, title, videoTracks }: StreamPlayerProps) {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'connecting',
    lastUpdate: new Date(),
    errorCount: 0
  });

  const handleReady = useCallback(() => {
    setIsReady(true);
    setError(null);
    setConnectionState({
      status: 'connected',
      lastUpdate: new Date(),
      errorCount: 0,
      message: 'Stream connected successfully'
    });
  }, []);

  const handleError = useCallback((e: any) => {
    console.error('Stream playback error:', e);
    let errorMessage = 'Failed to load stream';
    
    if (!url) {
      errorMessage = 'No stream URL provided';
    } else if (e === 'hlsError') {
      errorMessage = 'Failed to load HLS stream. The stream might be offline or the URL is incorrect.';
    } else if (typeof e === 'object' && e.message) {
      errorMessage = e.message;
    }
    
    console.log('Stream error details:', {
      url,
      error: e,
      message: errorMessage,
      errorType: typeof e,
      errorKeys: e && typeof e === 'object' ? Object.keys(e) : [],
      stackTrace: e && e.stack ? e.stack : 'No stack trace',
      expectedFormat: 'https://server.domain/streamKey/index.m3u8'
    });
    
    setError(errorMessage);
    setIsReady(false);
    
    setConnectionState(prev => {
      const newErrorCount = prev.errorCount + 1;
      return {
        status: newErrorCount > 3 ? 'error' : 'reconnecting',
        lastUpdate: new Date(),
        errorCount: newErrorCount,
        message: newErrorCount > 3 
          ? 'Stream connection failed. Please try again later.' 
          : `Reconnecting... (Attempt ${newErrorCount}/3)`
      };
    });
  }, [url]);

  const toggleFullscreen = useCallback(() => {
    const element = document.querySelector('.react-player');
    if (!element) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      element.requestFullscreen();
    }
  }, []);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-4">
        <CardTitle>{title || 'Live Stream'}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 relative aspect-video bg-black">
        {/* Connection Status Indicator */}
        <div className={cn(
          'absolute top-2 right-2 z-10 flex items-center gap-2 px-2 py-1 rounded-full',
          {
            'bg-yellow-500/80': connectionState.status === 'connecting',
            'bg-green-500/80': connectionState.status === 'connected',
            'bg-red-500/80': connectionState.status === 'error',
            'bg-blue-500/80': connectionState.status === 'reconnecting'
          }
        )}>
          <div className={cn(
            'w-2 h-2 rounded-full',
            {
              'animate-pulse bg-yellow-300': connectionState.status === 'connecting',
              'bg-green-300': connectionState.status === 'connected',
              'bg-red-300': connectionState.status === 'error',
              'animate-pulse bg-blue-300': connectionState.status === 'reconnecting'
            }
          )} />
          <span className="text-xs font-medium text-white">
            {connectionState.status === 'connected' ? 'Live' : connectionState.message}
          </span>
        </div>
        
        {/* Loading/Error State */}
        <div className={cn(
          'absolute inset-0 flex items-center justify-center',
          isReady ? 'opacity-0' : 'opacity-100'
        )}>
          {error ? (
            <div className="text-destructive flex flex-col items-center gap-2">
              <span>{error}</span>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsPlaying(true);
                  setConnectionState({
                    status: 'connecting',
                    lastUpdate: new Date(),
                    errorCount: 0,
                    message: 'Connecting to stream...'
                  });
                }}
              >
                Retry
              </Button>
            </div>
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          )}
        </div>
        
        <ReactPlayer
          url={url}
          width="100%"
          height="100%"
          playing={isPlaying}
          muted={isMuted}
          onReady={handleReady}
          onError={handleError}
          className="react-player"
          config={{
            file: {
              forceHLS: true,
              hlsVersion: '1.4.12', // Specify HLS.js version
              hlsOptions: {
                enableWorker: true,
                debug: true, // Enable debug logs to see what's happening
                xhrSetup: function(xhr: XMLHttpRequest, url: string) {
                  xhr.withCredentials = false;
                  console.log('HLS.js making request to:', url);
                },
                // More aggressive retry strategy
                manifestLoadingTimeOut: 10000, // Reduced timeout for faster feedback
                manifestLoadingMaxRetry: 6,
                manifestLoadingRetryDelay: 1000, // 1 second between retries
                levelLoadingTimeOut: 10000,
                levelLoadingMaxRetry: 6,
                levelLoadingRetryDelay: 1000,
                fragLoadingTimeOut: 20000,
                fragLoadingMaxRetry: 6,
                fragLoadingRetryDelay: 1000,
                // Optimize for live streaming
                liveSyncDurationCount: 3,
                liveMaxLatencyDurationCount: 10,
                liveDurationInfinity: true,
                liveBackBufferLength: 30,
                // Enable low latency mode with appropriate settings
                lowLatencyMode: true,
                // Recovery settings
                testBandwidth: true,
                progressive: true,
                // Disable unnecessary features
                enableWebVTT: false,
                enableIMSC1: false,
                enableCEA708Captions: false,
              },
            },
          }}
          onProgress={(state) => {
            console.log('Player progress:', state);
          }}
          onBuffer={() => {
            console.log('Player buffering...');
          }}
          onBufferEnd={() => {
            console.log('Player buffering ended');
          }}
          onProgress={(state) => {
            console.log('Player progress:', state);
          }}
          onBuffer={() => {
            console.log('Player buffering...');
          }}
          onBufferEnd={() => {
            console.log('Player buffering ended');
          }}
        />
        
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:text-white hover:bg-white/20"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:text-white hover:bg-white/20"
              onClick={toggleFullscreen}
            >
              <Maximize className="h-5 w-5" />
            </Button>
            {videoTracks && videoTracks.length > 0 && (
              <Select defaultValue="auto">
                <SelectTrigger className="w-[120px] bg-black/20 border-white/10 text-white">
                  <SelectValue placeholder="Quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  {videoTracks.map((track, index) => (
                    <SelectItem key={index} value={`${track.height}p`}>
                      {track.height}p {track.bitrate ? `(${Math.round(track.bitrate/1000)}Mbps)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}