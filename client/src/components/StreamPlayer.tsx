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

export default function StreamPlayer({ url, title, videoTracks }: StreamPlayerProps) {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReady = useCallback(() => {
    setIsReady(true);
    setError(null);
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
      message: errorMessage
    });
    
    setError(errorMessage);
    setIsReady(false);
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
        <div className={cn(
          'absolute inset-0 flex items-center justify-center',
          isReady ? 'opacity-0' : 'opacity-100'
        )}>
          {error ? (
            <div className="text-destructive flex flex-col items-center gap-2">
              <span>{error}</span>
              <Button 
                variant="outline" 
                onClick={() => setIsPlaying(true)}
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
              hlsOptions: {
                enableWorker: true,
                debug: false,
                xhrSetup: function(xhr: XMLHttpRequest) {
                  xhr.withCredentials = false;
                },
                manifestLoadingTimeOut: 20000,
                manifestLoadingMaxRetry: 5,
                levelLoadingTimeOut: 20000,
                levelLoadingMaxRetry: 5,
                fragLoadingTimeOut: 20000,
                fragLoadingMaxRetry: 5,
                startLevel: -1, // Auto quality selection
                defaultAudioCodec: undefined,
                progressive: true, // Enable for better support
                lowLatencyMode: true,
                backBufferLength: 90
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