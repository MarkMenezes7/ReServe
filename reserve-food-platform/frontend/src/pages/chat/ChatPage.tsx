import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Send,
  Image,
  Check,
  CheckCheck,
  MessageCircle,
  Search,
  Zap,
  X,
  ChevronDown,
  ArrowLeft,
} from 'lucide-react';
import { useToast } from '../../components/ToastProvider';
import { chatApi } from '../../services/api';
import type { Message, Conversation } from '../../types';
import './ChatPage.css';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const QUICK_REPLIES = [
  'On my way',
  'Ready for pickup',
  'Thank you!',
  'Running late',
  'Package ready',
];

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = today.getTime() - msgDate.getTime();
  const dayMs = 86400000;

  if (diff === 0) return 'Today';
  if (diff === dayMs) return 'Yesterday';
  if (diff < 7 * dayMs) {
    return d.toLocaleDateString([], { weekday: 'long' });
  }
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function groupMessagesByDate(messages: Message[]): { label: string; messages: Message[] }[] {
  const groups: { label: string; messages: Message[] }[] = [];
  let currentLabel = '';

  for (const msg of messages) {
    const label = formatDateLabel(msg.createdAt);
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }

  return groups;
}

const ChatPage = () => {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const userId = Number(localStorage.getItem('userId'));
  const userName = localStorage.getItem('userName') || 'User';
  const userType = localStorage.getItem('userType');
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeClaimId, setActiveClaimId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const socket = useMemo(() => io(SOCKET_URL), []);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.claimId === activeClaimId) || null,
    [conversations, activeClaimId]
  );

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.foodName.toLowerCase().includes(q) ||
        c.counterpartName.toLowerCase().includes(q) ||
        (c.counterpartOrg && c.counterpartOrg.toLowerCase().includes(q))
    );
  }, [conversations, searchQuery]);

  // Load conversations
  useEffect(() => {
    if (!userId) return;
    setLoadingConversations(true);
    chatApi
      .getConversations(userId)
      .then((data) => {
        setConversations(data || []);
        const paramClaim = searchParams.get('claim');
        if (paramClaim) {
          const claimNum = Number(paramClaim);
          if (data.some((c: Conversation) => c.claimId === claimNum)) {
            setActiveClaimId(claimNum);
          } else if (data.length > 0) {
            setActiveClaimId(data[0].claimId);
          }
        } else if (data.length > 0 && !activeClaimId) {
          setActiveClaimId(data[0].claimId);
        }
      })
      .catch(() => showToast('Failed to load conversations', 'error'))
      .finally(() => setLoadingConversations(false));
  }, [userId]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeClaimId) return;
    setLoadingMessages(true);
    chatApi
      .getMessages(activeClaimId)
      .then((data) => {
        setMessages(data || []);
        // Mark as read
        chatApi.markRead(activeClaimId).catch(() => {});
        // Update unread count locally
        setConversations((prev) =>
          prev.map((c) => (c.claimId === activeClaimId ? { ...c, unreadCount: 0 } : c))
        );
      })
      .catch(() => showToast('Failed to load messages', 'error'))
      .finally(() => setLoadingMessages(false));
  }, [activeClaimId]);

  // Socket connection and room management
  useEffect(() => {
    if (!socket || !userId) return;

    socket.emit('joinUserRoom', { userId });

    return () => {
      socket.disconnect();
    };
  }, [socket, userId]);

  // Join claim room when active changes
  useEffect(() => {
    if (!socket || !activeClaimId) return;
    socket.emit('joinRoom', { claimId: activeClaimId });
  }, [socket, activeClaimId]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (message: Message) => {
      if (message.claimId === activeClaimId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
        // Mark as read since user is viewing this conversation
        if (message.senderId !== userId) {
          chatApi.markRead(message.claimId).catch(() => {});
          socket.emit('markRead', { claimId: message.claimId, userId });
        }
      } else {
        // Increment unread count for other conversations
        setConversations((prev) =>
          prev.map((c) =>
            c.claimId === message.claimId
              ? {
                  ...c,
                  unreadCount: (c.unreadCount || 0) + 1,
                  lastMessage: message.content,
                  lastMessageAt: message.createdAt,
                }
              : c
          )
        );
      }
    };

    const onUserTyping = (data: { claimId: number; userName: string; userId: number }) => {
      if (data.claimId === activeClaimId && data.userId !== userId) {
        setTypingUser(data.userName);
      }
    };

    const onUserStopTyping = (data: { claimId: number; userId: number }) => {
      if (data.claimId === activeClaimId && data.userId !== userId) {
        setTypingUser(null);
      }
    };

    const onMessagesRead = (data: { claimId: number; userId: number }) => {
      if (data.claimId === activeClaimId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === userId && m.claimId === data.claimId ? { ...m, isRead: 1 } : m
          )
        );
      }
    };

    socket.on('newMessage', onNewMessage);
    socket.on('userTyping', onUserTyping);
    socket.on('userStopTyping', onUserStopTyping);
    socket.on('messagesRead', onMessagesRead);

    return () => {
      socket.off('newMessage', onNewMessage);
      socket.off('userTyping', onUserTyping);
      socket.off('userStopTyping', onUserStopTyping);
      socket.off('messagesRead', onMessagesRead);
    };
  }, [socket, activeClaimId, userId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (threadRef.current) {
      const el = threadRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (isNearBottom || messages.length <= 1) {
        setTimeout(() => {
          el.scrollTop = el.scrollHeight;
        }, 50);
      }
    }
  }, [messages, typingUser]);

  // Scroll detection for "scroll down" button
  const handleThreadScroll = useCallback(() => {
    if (!threadRef.current) return;
    const el = threadRef.current;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollDown(gap > 300);
  }, []);

  const scrollToBottom = () => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  };

  // Typing indicators
  const handleTyping = () => {
    if (!socket || !activeClaimId) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing', { claimId: activeClaimId, userId, userName });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('stopTyping', { claimId: activeClaimId, userId });
    }, 2000);
  };

  // Send message via REST API (reliable, authenticated, with error handling)
  const handleSend = async (content?: string, messageType?: string, imageUrl?: string) => {
    const text = content || draft.trim();
    if (!text && !imageUrl) return;
    if (!activeConversation) return;

    const receiverId = activeConversation.counterpartId;

    // Clear input immediately for responsiveness
    if (!content) setDraft('');
    setImagePreview(null);
    setShowQuickReplies(false);
    inputRef.current?.focus();

    // Stop typing indicator
    if (isTyping && socket) {
      setIsTyping(false);
      socket.emit('stopTyping', { claimId: activeClaimId, userId });
    }

    try {
      const message = await chatApi.sendMessage({
        claimId: activeConversation.claimId,
        receiverId,
        content: text || 'Sent an image',
        messageType: messageType || (imageUrl ? 'image' : 'text'),
        imageUrl,
      });

      // Add to local state (socket newMessage listener deduplicates by id)
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });

      // Update conversation's last message
      setConversations((prev) =>
        prev.map((c) =>
          c.claimId === activeConversation.claimId
            ? { ...c, lastMessage: text || 'Sent an image', lastMessageAt: message.createdAt }
            : c
        )
      );
    } catch {
      showToast('Failed to send message', 'error');
    }
  };

  // Quick reply
  const handleQuickReply = (text: string) => {
    handleSend(text, 'quick-reply');
  };

  // Image upload
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be less than 5MB', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendImage = () => {
    if (!imagePreview) return;
    handleSend('Sent an image', 'image', imagePreview);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (imagePreview) {
        sendImage();
      } else {
        handleSend();
      }
    }
  };

  const selectConversation = (claimId: number) => {
    setActiveClaimId(claimId);
    setTypingUser(null);
    setShowQuickReplies(false);
    setImagePreview(null);
  };

  const dateGroups = groupMessagesByDate(messages);

  const dashboardPath = userType === 'donor' ? '/donor/dashboard' : userType === 'admin' ? '/admin/dashboard' : '/ngo/dashboard';

  return (
    <div className="chat-container">
      <div className="chat-header-bar">
        <button className="chat-back-btn" onClick={() => navigate(dashboardPath)}>
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>
        <h1 className="chat-page-title">Messages</h1>
      </div>
      <div className="chat-page">
        {/* Conversation Sidebar */}
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h2 className="chat-sidebar-title">Conversations</h2>
            <span className="chat-conv-count">{conversations.length}</span>
          </div>

          <div className="chat-search-wrap">
            <Search size={15} className="chat-search-icon" />
            <input
              type="text"
              className="chat-search"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="conversation-list">
            {loadingConversations ? (
              <div className="chat-empty-state">
                <div className="chat-loading-dots">
                  <span></span><span></span><span></span>
                </div>
                <p>Loading conversations...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="chat-empty-state">
                <MessageCircle size={32} />
                <p>{searchQuery ? 'No matching conversations' : 'No conversations yet'}</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.claimId}
                  className={`conversation-item ${activeClaimId === conv.claimId ? 'active' : ''}`}
                  onClick={() => selectConversation(conv.claimId)}
                >
                  <div className="conv-avatar">
                    {conv.counterpartName.charAt(0).toUpperCase()}
                  </div>
                  <div className="conv-info">
                    <div className="conv-top-row">
                      <span className="conv-name">{conv.counterpartName}</span>
                      {conv.lastMessageAt && (
                        <span className="conv-time">{formatTime(conv.lastMessageAt)}</span>
                      )}
                    </div>
                    <div className="conv-bottom-row">
                      <span className="conv-food">{conv.foodName}</span>
                      {(conv.unreadCount ?? 0) > 0 && (
                        <span className="conv-unread">{conv.unreadCount}</span>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <p className="conv-last-msg">{conv.lastMessage}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Message Area */}
        <section className="chat-panel">
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="chat-panel-header">
                <div className="chat-panel-user">
                  <div className="chat-panel-avatar">
                    {activeConversation.counterpartName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="chat-panel-name">{activeConversation.counterpartName}</h3>
                    <p className="chat-panel-sub">
                      {activeConversation.counterpartOrg
                        ? activeConversation.counterpartOrg
                        : activeConversation.foodName}{' '}
                      &middot;{' '}
                      <span
                        className={`chat-status-badge chat-status-${activeConversation.status}`}
                      >
                        {activeConversation.status}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="chat-panel-food-label">
                  {activeConversation.foodName}
                </div>
              </div>

              {/* Message Thread */}
              <div
                className="chat-thread"
                ref={threadRef}
                onScroll={handleThreadScroll}
              >
                {loadingMessages ? (
                  <div className="chat-empty-state thread-empty">
                    <div className="chat-loading-dots">
                      <span></span><span></span><span></span>
                    </div>
                    <p>Loading messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="chat-empty-state thread-empty">
                    <MessageCircle size={40} />
                    <h4>No messages yet</h4>
                    <p>Send a message or use a quick reply to start the conversation.</p>
                  </div>
                ) : (
                  dateGroups.map((group) => (
                    <div key={group.label} className="chat-date-group">
                      <div className="chat-date-divider">
                        <span>{group.label}</span>
                      </div>
                      {group.messages.map((message) => {
                        const isSent = message.senderId === userId;
                        return (
                          <div
                            key={message.id}
                            className={`chat-bubble ${isSent ? 'sent' : 'received'}`}
                          >
                            {message.messageType === 'image' && message.imageUrl && (
                              <div className="chat-bubble-image">
                                <img
                                  src={message.imageUrl}
                                  alt="Shared"
                                  onClick={() => window.open(message.imageUrl, '_blank')}
                                />
                              </div>
                            )}
                            {message.content && (
                              <p className="chat-bubble-text">{message.content}</p>
                            )}
                            <div className="chat-bubble-meta">
                              <span className="chat-bubble-time">
                                {formatTime(message.createdAt)}
                              </span>
                              {isSent && (
                                <span className="chat-bubble-receipt">
                                  {message.isRead ? (
                                    <CheckCheck size={14} className="receipt-read" />
                                  ) : (
                                    <Check size={14} className="receipt-sent" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}

                {/* Typing indicator */}
                {typingUser && (
                  <div className="chat-typing-indicator">
                    <div className="typing-dots">
                      <span></span><span></span><span></span>
                    </div>
                    <span className="typing-label">{typingUser} is typing...</span>
                  </div>
                )}
              </div>

              {/* Scroll down button */}
              {showScrollDown && (
                <button className="chat-scroll-down" onClick={scrollToBottom}>
                  <ChevronDown size={18} />
                </button>
              )}

              {/* Image preview */}
              {imagePreview && (
                <div className="chat-image-preview">
                  <img src={imagePreview} alt="Preview" />
                  <div className="chat-image-preview-actions">
                    <button
                      className="chat-image-cancel"
                      onClick={() => setImagePreview(null)}
                    >
                      <X size={16} /> Cancel
                    </button>
                    <button className="chat-image-send" onClick={sendImage}>
                      <Send size={16} /> Send Image
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Replies */}
              {showQuickReplies && (
                <div className="chat-quick-replies">
                  {QUICK_REPLIES.map((text) => (
                    <button
                      key={text}
                      className="quick-reply-btn"
                      onClick={() => handleQuickReply(text)}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Area */}
              <div className="chat-input-area">
                <button
                  className={`chat-input-action ${showQuickReplies ? 'active' : ''}`}
                  onClick={() => setShowQuickReplies(!showQuickReplies)}
                  title="Quick replies"
                >
                  <Zap size={18} />
                </button>

                <button
                  className="chat-input-action"
                  onClick={() => fileInputRef.current?.click()}
                  title="Send image"
                >
                  <Image size={18} />
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageSelect}
                />

                <input
                  ref={inputRef}
                  type="text"
                  className="chat-text-input"
                  placeholder="Type a message..."
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    handleTyping();
                  }}
                  onKeyDown={handleKeyDown}
                />

                <button
                  className="chat-send-btn"
                  onClick={() => {
                    if (imagePreview) {
                      sendImage();
                    } else {
                      handleSend();
                    }
                  }}
                  disabled={!draft.trim() && !imagePreview}
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          ) : (
            <div className="chat-empty-state panel-empty">
              <MessageCircle size={56} />
              <h3>Welcome to Messages</h3>
              <p>Select a conversation from the sidebar to start chatting.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ChatPage;
