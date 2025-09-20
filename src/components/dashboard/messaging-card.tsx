
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { MessageSquare, Send, Bell, Bot, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useState, useEffect, useRef } from "react"
import { ScrollArea } from "../ui/scroll-area"
import type { Message } from "@/lib/data"
import { cn } from "@/lib/utils"
import { db } from "@/lib/firebase"
import { ref, onValue, set, update, serverTimestamp, push, remove } from "firebase/database"


interface MessagingCardProps {
    studentId: string;
}

const CLEAR_COMMAND = "<admin>:/clear";

export function MessagingCard({ studentId }: MessagingCardProps) {
    const { toast } = useToast();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [hasUnread, setHasUnread] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const chatDocRef = ref(db, `chats/${studentId}`);
    const notificationShownRef = useRef(false);
    
    useEffect(() => {
        const unsubscribe = onValue(chatDocRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setMessages(data.messages ? Object.values(data.messages) : []);
                if (data.unreadByAdmin) {
                    setHasUnread(true);
                     if (!notificationShownRef.current) {
                        toast({
                            title: "New Message from Parent",
                            description: `A new message from the parent of student ${studentId}.`,
                        });
                        notificationShownRef.current = true;
                    }
                } else {
                    setHasUnread(false);
                    notificationShownRef.current = false; // Reset when messages are read
                }
            } else {
                setMessages([]);
                setHasUnread(false);
            }
        });
        
        return () => unsubscribe();
    }, [chatDocRef, studentId, toast]);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({
                top: scrollAreaRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages]);


    const clearChatHistory = async () => {
        try {
            await remove(chatDocRef);
            setNewMessage("");
            toast({
                title: "Chat Cleared",
                description: `Chat history for student ${studentId} has been cleared.`,
            });
        } catch (error) {
            console.error("Error clearing chat:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not clear chat history." });
        }
    }

    const handleSend = async () => {
        if (!newMessage.trim()) return;
        
        const currentMessage = newMessage;
        setNewMessage("");

        if (currentMessage.trim() === CLEAR_COMMAND) {
            await clearChatHistory();
            return;
        }

        const message: Message = {
            id: Date.now(),
            sender: 'Admin',
            text: currentMessage,
            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        };

        try {
            const messageListRef = ref(db, `chats/${studentId}/messages`);
            const newMessageRef = push(messageListRef);
            await set(newMessageRef, message);
            await update(chatDocRef, {
                unreadByAdmin: false,
                lastMessageTimestamp: serverTimestamp(),
            });

            toast({
                title: "Message Sent",
                description: "Your reply has been sent to the parent.",
                className: "bg-accent text-accent-foreground border-accent",
            });
        } catch (error) {
            console.error("Error sending message:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to send message." });
            setNewMessage(currentMessage);
        }
    }

    const markAsRead = async () => {
        if (hasUnread) {
            try {
                await update(chatDocRef, { unreadByAdmin: false });
                setHasUnread(false);
                notificationShownRef.current = false;
            } catch (error) {
                console.error("Error marking as read:", error);
            }
        }
    }

    return (
    <Card onClick={markAsRead} onFocus={markAsRead}>
        <CardHeader className="cursor-pointer">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <CardTitle>Parent Messages</CardTitle>
                </div>
                {hasUnread && (
                    <div className="flex items-center gap-2 text-sm text-primary font-semibold animate-pulse">
                        <Bell className="h-4 w-4" />
                        <span>New Message!</span>
                    </div>
                )}
            </div>
            <CardDescription>
                Communicate directly with the parent. Type {'`<admin>:/clear`'} to clear history.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
             <ScrollArea className="h-[250px] w-full rounded-md border p-4" ref={scrollAreaRef}>
                <div className="space-y-4">
                    {messages.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center">No messages yet.</p>
                    ) : (
                        messages.map((msg) => (
                           <div key={msg.id} className={cn("flex items-start gap-3", msg.sender === 'Admin' ? "justify-end" : "justify-start")}>
                                {msg.sender !== 'Admin' && (msg.sender === 'bot' ? <Bot className="h-6 w-6 text-primary shrink-0" /> : <User className="h-6 w-6 text-muted-foreground shrink-0" />)}
                                <div className={cn("p-3 rounded-lg max-w-[80%]", msg.sender === 'Admin' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                                    <p className="text-sm">{msg.text}</p>
                                    {msg.timestamp && <p className="text-xs text-right mt-1 opacity-70">{msg.timestamp}</p>}
                                </div>
                                {msg.sender === 'Admin' && <User className="h-6 w-6 text-primary shrink-0" />}
                            </div>
                        ))
                    )}
                </div>
             </ScrollArea>
            <div className="flex items-center gap-2">
                <Textarea 
                    placeholder="Type your reply here..." 
                    className="min-h-[40px]"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                    onFocus={markAsRead}
                />
                <Button onClick={handleSend} disabled={!newMessage.trim()} size="icon">
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </CardContent>
    </Card>
  )
}
