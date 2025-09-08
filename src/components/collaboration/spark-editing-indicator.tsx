import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SparkEditingSession } from '@/lib/socket-client';
import { Edit, Users } from 'lucide-react';

interface SparkEditingIndicatorProps {
  sessions: SparkEditingSession[];
  variant?: 'compact' | 'full';
  showIcon?: boolean;
}

export const SparkEditingIndicator: React.FC<SparkEditingIndicatorProps> = ({
  sessions,
  variant = 'compact',
  showIcon = true
}) => {
  if (sessions.length === 0) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="secondary" className="gap-1.5">
              {showIcon && <Edit className="w-3 h-3" />}
              <Users className="w-3 h-3" />
              {sessions.length}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm max-w-48">
              <div className="font-medium mb-1">Currently editing:</div>
              {sessions.map((session, index) => (
                <div key={`${session.userId}-${session.sparkId}`} className="text-muted-foreground">
                  {session.username}
                  {index < sessions.length - 1 && ', '}
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border">
      {showIcon && <Edit className="w-4 h-4 text-muted-foreground" />}
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground">Editing:</span>
        <div className="flex -space-x-1">
          {sessions.slice(0, 3).map((session) => (
            <TooltipProvider key={`${session.userId}-${session.sparkId}`}>
              <Tooltip>
                <TooltipTrigger>
                  <Avatar className="w-6 h-6 border-2 border-background">
                    <AvatarFallback className="text-xs">
                      {session.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    <div className="font-medium">{session.username}</div>
                    <div className="text-muted-foreground">Editing since {new Date(session.startedAt).toLocaleTimeString()}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
          {sessions.length > 3 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted border-2 border-background">
                    <span className="text-xs font-medium text-muted-foreground">
                      +{sessions.length - 3}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm max-w-48">
                    {sessions.slice(3).map((session, index) => (
                      <div key={`${session.userId}-${session.sparkId}`} className="text-muted-foreground">
                        {session.username}
                        {index < sessions.length - 4 && ', '}
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  );
};