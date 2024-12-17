import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { api } from '@/lib/api';
import type { Server } from '@db/schema';

interface AIErrorTooltipProps {
  server: Server;
}

export function AIErrorTooltip({ server }: AIErrorTooltipProps) {
  const [showAnalysis, setShowAnalysis] = useState(false);

  const { data: analysis, isLoading } = useQuery({
    queryKey: [`/api/servers/${server.id}/analyze-error`, showAnalysis],
    queryFn: () => api.analyzeServerError(server.id),
    enabled: showAnalysis,
  });

  return (
    <TooltipProvider>
      <Tooltip onOpenChange={setShowAnalysis}>
        <TooltipTrigger>
          <AlertCircle className="w-4 h-4 text-destructive" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[300px]">
          <div className="space-y-2">
            <p className="font-medium">Error Details</p>
            <p>{server.lastError}</p>
            {server.lastErrorAt && (
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(server.lastErrorAt), { addSuffix: true })}
              </p>
            )}
            
            <div className="border-t pt-2 mt-2">
              <p className="font-medium mb-1">AI Analysis</p>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Analyzing error...
                </div>
              ) : analysis ? (
                <p className="text-sm">{analysis.analysis}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Hover to analyze the error
                </p>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
