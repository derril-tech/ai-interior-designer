'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    MessageSquare,
    Send,
    Reply,
    ThumbsUp,
    ThumbsDown,
    MoreHorizontal,
    Edit,
    Trash2,
    Pin,
    Share2,
    Clock,
    CheckCircle,
    AlertCircle
} from 'lucide-react';

interface LayoutCommentsProps {
    layoutId: string;
    layoutName: string;
    onCommentAdded?: (comment: Comment) => void;
}

interface Comment {
    id: string;
    author: {
        id: string;
        name: string;
        avatar?: string;
        role: 'owner' | 'collaborator' | 'viewer';
    };
    content: string;
    timestamp: string;
    edited?: boolean;
    pinned?: boolean;
    reactions: {
        likes: number;
        dislikes: number;
        userReaction?: 'like' | 'dislike' | null;
    };
    replies: Reply[];
    status?: 'open' | 'resolved' | 'archived';
    tags?: string[];
}

interface Reply {
    id: string;
    author: {
        id: string;
        name: string;
        avatar?: string;
    };
    content: string;
    timestamp: string;
    edited?: boolean;
}

export function LayoutComments({ layoutId, layoutName, onCommentAdded }: LayoutCommentsProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

    useEffect(() => {
        loadComments();
    }, [layoutId]);

    const loadComments = async () => {
        setIsLoading(true);

        // Mock comments data
        const mockComments: Comment[] = [
            {
                id: '1',
                author: {
                    id: 'user1',
                    name: 'Sarah Johnson',
                    avatar: '/avatars/sarah.jpg',
                    role: 'owner'
                },
                content: 'I love the overall layout! The conversation area looks very inviting. However, I\'m wondering if we could move the coffee table a bit closer to the sofa for better functionality.',
                timestamp: '2024-01-15T10:30:00Z',
                pinned: true,
                reactions: {
                    likes: 3,
                    dislikes: 0,
                    userReaction: null
                },
                replies: [
                    {
                        id: 'r1',
                        author: {
                            id: 'designer1',
                            name: 'Alex Chen'
                        },
                        content: 'Great suggestion! I can adjust the coffee table position. The current placement ensures proper walkway clearance, but we can bring it 20cm closer while maintaining flow.',
                        timestamp: '2024-01-15T11:15:00Z'
                    }
                ],
                status: 'open',
                tags: ['furniture-placement', 'coffee-table']
            },
            {
                id: '2',
                author: {
                    id: 'user2',
                    name: 'Mike Rodriguez',
                    avatar: '/avatars/mike.jpg',
                    role: 'collaborator'
                },
                content: 'The TV viewing angle looks perfect from the main seating area. What about adding some ambient lighting behind the TV to reduce eye strain during evening viewing?',
                timestamp: '2024-01-15T14:20:00Z',
                reactions: {
                    likes: 2,
                    dislikes: 0,
                    userReaction: 'like'
                },
                replies: [],
                status: 'open',
                tags: ['lighting', 'tv-setup']
            },
            {
                id: '3',
                author: {
                    id: 'user3',
                    name: 'Emma Wilson',
                    avatar: '/avatars/emma.jpg',
                    role: 'viewer'
                },
                content: 'Budget looks good overall. I noticed the sofa is quite an investment - are there any similar alternatives that might be more cost-effective?',
                timestamp: '2024-01-15T16:45:00Z',
                reactions: {
                    likes: 1,
                    dislikes: 0,
                    userReaction: null
                },
                replies: [],
                status: 'resolved',
                tags: ['budget', 'alternatives']
            }
        ];

        setComments(mockComments);
        setIsLoading(false);
    };

    const addComment = async () => {
        if (!newComment.trim()) return;

        const comment: Comment = {
            id: Date.now().toString(),
            author: {
                id: 'current-user',
                name: 'You',
                role: 'owner'
            },
            content: newComment,
            timestamp: new Date().toISOString(),
            reactions: {
                likes: 0,
                dislikes: 0,
                userReaction: null
            },
            replies: [],
            status: 'open'
        };

        setComments(prev => [comment, ...prev]);
        setNewComment('');
        onCommentAdded?.(comment);
    };

    const addReply = async (commentId: string) => {
        if (!replyContent.trim()) return;

        const reply: Reply = {
            id: Date.now().toString(),
            author: {
                id: 'current-user',
                name: 'You'
            },
            content: replyContent,
            timestamp: new Date().toISOString()
        };

        setComments(prev => prev.map(comment =>
            comment.id === commentId
                ? { ...comment, replies: [...comment.replies, reply] }
                : comment
        ));

        setReplyContent('');
        setReplyingTo(null);
    };

    const toggleReaction = (commentId: string, reaction: 'like' | 'dislike') => {
        setComments(prev => prev.map(comment => {
            if (comment.id !== commentId) return comment;

            const currentReaction = comment.reactions.userReaction;
            let newLikes = comment.reactions.likes;
            let newDislikes = comment.reactions.dislikes;
            let newUserReaction: 'like' | 'dislike' | null = reaction;

            // Remove previous reaction
            if (currentReaction === 'like') newLikes--;
            if (currentReaction === 'dislike') newDislikes--;

            // Add new reaction or remove if same
            if (currentReaction === reaction) {
                newUserReaction = null;
            } else {
                if (reaction === 'like') newLikes++;
                if (reaction === 'dislike') newDislikes++;
            }

            return {
                ...comment,
                reactions: {
                    likes: newLikes,
                    dislikes: newDislikes,
                    userReaction: newUserReaction
                }
            };
        }));
    };

    const toggleCommentStatus = (commentId: string) => {
        setComments(prev => prev.map(comment =>
            comment.id === commentId
                ? {
                    ...comment,
                    status: comment.status === 'resolved' ? 'open' : 'resolved'
                }
                : comment
        ));
    };

    const pinComment = (commentId: string) => {
        setComments(prev => prev.map(comment =>
            comment.id === commentId
                ? { ...comment, pinned: !comment.pinned }
                : comment
        ));
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'owner': return 'text-blue-600 bg-blue-100';
            case 'collaborator': return 'text-green-600 bg-green-100';
            case 'viewer': return 'text-gray-600 bg-gray-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getStatusIcon = (status?: string) => {
        switch (status) {
            case 'resolved': return <CheckCircle className="h-4 w-4 text-green-600" />;
            case 'open': return <AlertCircle className="h-4 w-4 text-blue-600" />;
            default: return null;
        }
    };

    const filteredComments = comments.filter(comment => {
        if (filter === 'all') return true;
        return comment.status === filter;
    });

    const sortedComments = [...filteredComments].sort((a, b) => {
        // Pinned comments first
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        // Then by timestamp (newest first)
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Comments
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse">
                                <div className="h-16 bg-gray-200 rounded"></div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5" />
                                Comments & Feedback
                            </CardTitle>
                            <CardDescription>
                                Collaborate on "{layoutName}" with your team
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant={filter === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilter('all')}
                            >
                                All ({comments.length})
                            </Button>
                            <Button
                                variant={filter === 'open' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilter('open')}
                            >
                                Open ({comments.filter(c => c.status === 'open').length})
                            </Button>
                            <Button
                                variant={filter === 'resolved' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilter('resolved')}
                            >
                                Resolved ({comments.filter(c => c.status === 'resolved').length})
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* New Comment */}
            <Card>
                <CardContent className="p-4">
                    <div className="space-y-3">
                        <Textarea
                            placeholder="Add a comment or suggestion..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="min-h-[80px]"
                        />
                        <div className="flex justify-between items-center">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                Tip: Use @mentions to notify team members
                            </div>
                            <Button onClick={addComment} disabled={!newComment.trim()}>
                                <Send className="mr-2 h-4 w-4" />
                                Comment
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Comments List */}
            <div className="space-y-4">
                {sortedComments.map((comment) => (
                    <Card key={comment.id} className={comment.pinned ? 'border-blue-200 bg-blue-50 dark:bg-blue-950' : ''}>
                        <CardContent className="p-4">
                            <div className="space-y-3">
                                {/* Comment Header */}
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={comment.author.avatar} />
                                            <AvatarFallback>
                                                {comment.author.name.split(' ').map(n => n[0]).join('')}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{comment.author.name}</span>
                                                <Badge className={`${getRoleColor(comment.author.role)} border-0 text-xs`}>
                                                    {comment.author.role}
                                                </Badge>
                                                {comment.pinned && <Pin className="h-3 w-3 text-blue-600" />}
                                                {getStatusIcon(comment.status)}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                <Clock className="h-3 w-3" />
                                                {formatTimestamp(comment.timestamp)}
                                                {comment.edited && <span className="text-xs">(edited)</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Comment Content */}
                                <div className="ml-11">
                                    <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                                        {comment.content}
                                    </p>

                                    {/* Tags */}
                                    {comment.tags && comment.tags.length > 0 && (
                                        <div className="flex gap-1 mt-2">
                                            {comment.tags.map((tag) => (
                                                <Badge key={tag} variant="secondary" className="text-xs">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Comment Actions */}
                                <div className="ml-11 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleReaction(comment.id, 'like')}
                                            className={comment.reactions.userReaction === 'like' ? 'text-blue-600' : ''}
                                        >
                                            <ThumbsUp className="mr-1 h-3 w-3" />
                                            {comment.reactions.likes}
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleReaction(comment.id, 'dislike')}
                                            className={comment.reactions.userReaction === 'dislike' ? 'text-red-600' : ''}
                                        >
                                            <ThumbsDown className="mr-1 h-3 w-3" />
                                            {comment.reactions.dislikes}
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                                        >
                                            <Reply className="mr-1 h-3 w-3" />
                                            Reply
                                        </Button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => pinComment(comment.id)}
                                        >
                                            <Pin className="h-3 w-3" />
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleCommentStatus(comment.id)}
                                        >
                                            {comment.status === 'resolved' ? 'Reopen' : 'Resolve'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Reply Form */}
                                {replyingTo === comment.id && (
                                    <div className="ml-11 mt-3 space-y-2">
                                        <Textarea
                                            placeholder="Write a reply..."
                                            value={replyContent}
                                            onChange={(e) => setReplyContent(e.target.value)}
                                            className="min-h-[60px]"
                                        />
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => addReply(comment.id)}>
                                                Reply
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => setReplyingTo(null)}>
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Replies */}
                                {comment.replies.length > 0 && (
                                    <div className="ml-11 space-y-3 pt-3 border-t">
                                        {comment.replies.map((reply) => (
                                            <div key={reply.id} className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={reply.author.avatar} />
                                                        <AvatarFallback className="text-xs">
                                                            {reply.author.name.split(' ').map(n => n[0]).join('')}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium text-sm">{reply.author.name}</span>
                                                    <span className="text-xs text-gray-600 dark:text-gray-400">
                                                        {formatTimestamp(reply.timestamp)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-900 dark:text-gray-100 ml-8">
                                                    {reply.content}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {sortedComments.length === 0 && (
                <Card>
                    <CardContent className="p-8 text-center">
                        <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            No comments yet
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Be the first to share feedback on this layout!
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
