'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useCollaborativeEditing } from '@/hooks/useCollaborativeEditing';
import { ParticipantInfo } from '@/types/collaborative-editing';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Users, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollaborativeEditorProps {
  sparkId: string;
  userId: string;
  username: string;
  initialContent?: string;
  onContentChange?: (content: string) => void;
  className?: string;
}

export function CollaborativeEditor({
  sparkId,
  userId,
  username,
  initialContent = '',
  onContentChange,
  className
}: CollaborativeEditorProps) {
  const socket = useSocket();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localContent, setLocalContent] = useState(initialContent);
  const [isTyping, setIsTyping] = useState(false);
  const lastCursorPosition = useRef<number>(0);

  const {
    isConnected,
    isReady,
    participants,
    documentState,
    pendingOperations,
    hasPendingOperations,
    insertText,
    deleteText,
    requestSync,
    getCurrentContent,
    getParticipantCount
  } = useCollaborativeEditing({
    socket,
    sparkId,
    userId,
    username
  });

  // Update local content when document state changes
  useEffect(() => {
    if (documentState && documentState.content !== localContent) {
      setLocalContent(documentState.content);
      onContentChange?.(documentState.content);
    }
  }, [documentState, localContent, onContentChange]);

  // Handle text area changes
  const handleContentChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = event.target.value;
    const currentContent = getCurrentContent();

    // Calculate the difference between current and new content
    if (newContent.length > currentContent.length) {
      // Text was inserted
      const cursorPos = event.target.selectionStart;
      const insertedText = newContent.slice(
        cursorPos - (newContent.length - currentContent.length),
        cursorPos
      );
      const insertPosition = cursorPos - insertedText.length;

      insertText(insertPosition, insertedText);
    } else if (newContent.length < currentContent.length) {
      // Text was deleted
      const deletedLength = currentContent.length - newContent.length;
      const cursorPos = event.target.selectionStart;

      deleteText(cursorPos, deletedLength);
    }

    setLocalContent(newContent);
    setIsTyping(true);

    // Clear typing indicator after a delay
    setTimeout(() => setIsTyping(false), 1000);
  }, [getCurrentContent, insertText, deleteText]);

  // Handle cursor position changes
  const handleSelectionChange = useCallback(() => {
    if (textareaRef.current) {
      lastCursorPosition.current = textareaRef.current.selectionStart;
    }
  }, []);

  // Sync with server
  const handleSync = useCallback(() => {
    requestSync();
  }, [requestSync]);

  // Get participant initials
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get connection status color
  const getStatusColor = (): string => {
    if (!isConnected) return 'text-red-500';
    if (hasPendingOperations) return 'text-yellow-500';
    return 'text-green-500';
  };

  // Get status icon
  const getStatusIcon = () => {
    if (!isConnected) return <AlertCircle className="h-4 w-4" />;
    if (hasPendingOperations) return <RefreshCw className="h-4 w-4 animate-spin" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Collaboration Status Bar */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className={cn('flex items-center gap-2', getStatusColor())}>
            {getStatusIcon()}
            <span className="text-sm font-medium">
              {!isConnected && 'Disconnected'}
              {isConnected && !isReady && 'Connecting...'}
              {isReady && hasPendingOperations && 'Syncing...'}
              {isReady && !hasPendingOperations && 'Connected'}
            </span>
          </div>

          {/* Participants */}
          {isConnected && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-500">
                {getParticipantCount()} collaborator{getParticipantCount() !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {hasPendingOperations && (
            <Badge variant="outline" className="text-xs">
              {pendingOperations.length} pending
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={!isConnected}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Sync
          </Button>
        </div>
      </div>

      {/* Participants List */}
      {participants.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            Active collaborators:
          </span>
          <div className="flex items-center gap-2">
            {participants.map((participant) => (
              <div
                key={participant.clientId}
                className="flex items-center gap-1"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src="" alt={participant.username} />
                  <AvatarFallback className="text-xs">
                    {getInitials(participant.username)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  {participant.username}
                </span>
                {participant.userId === userId && (
                  <Badge variant="secondary" className="text-xs ml-1">
                    You
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={localContent}
          onChange={handleContentChange}
          onSelect={handleSelectionChange}
          placeholder={
            isReady
              ? 'Start typing to collaborate in real-time...'
              : 'Connecting to collaborative session...'
          }
          disabled={!isReady}
          className={cn(
            'min-h-[300px] resize-none',
            !isReady && 'opacity-50 cursor-not-allowed'
          )}
        />

        {/* Typing Indicator */}
        {isTyping && (
          <div className="absolute top-2 right-2">
            <Badge variant="outline" className="text-xs">
              Typing...
            </Badge>
          </div>
        )}
      </div>

      {/* Debug Information (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs">
          <summary className="cursor-pointer font-medium">Debug Info</summary>
          <div className="mt-2 space-y-1">
            <p>Socket ID: {socket?.id || 'Not connected'}</p>
            <p>Spark ID: {sparkId}</p>
            <p>Document Version: {documentState?.version || 0}</p>
            <p>Pending Operations: {pendingOperations.length}</p>
            <p>Local Content Length: {localContent.length}</p>
            <p>Document Content Length: {documentState?.content?.length || 0}</p>
          </div>
        </details>
      )}
    </div>
  );
}
