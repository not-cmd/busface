
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bot, User, Send, Phone, MapPin, Clock, Trash2 } from "lucide-react"
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Message, Student } from '@/lib/data';
import { db } from '@/lib/firebase';
import { ref, onValue, set, update, serverTimestamp, push } from 'firebase/database';

interface ChatbotCardProps {
    student: Student & { busName: string, eta: string };
}

const initialMessage: Message = { id: Date.now(), sender: 'bot', text: "Hello! I'm GuardianBot. How can I help you today? You can ask me about bus location, ETA, or attendance." };

export function ChatbotCard({ student }: ChatbotCardProps) {
    const [messages, setMessages] = useState<Message[]>([initialMessage]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isTalkingToAdmin, setIsTalkingToAdmin] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    
    const chatDocRef = useMemo(() => ref(db, `chats/${student.studentId}`), [student.studentId]);

    const intents: { name: string; patterns: string[]; response: (s: Student & { busName: string, eta: string }) => string }[] = [
        {
            name: 'location',
            patterns: ['where is my child', 'where is the bus', 'bus location', 'current location', 'where'],
            response: () => "You can see the live location of the bus on the map on your dashboard."
        },
        {
            name: 'eta',
            patterns: ['eta', 'how long', 'time to reach', 'arrival time', 'when will'],
            response: (s) => `The Estimated Time of Arrival (ETA) is ${s.eta}.`
        },
        {
            name: 'driver_info',
            patterns: ['who is the driver', 'driver today', 'driving the bus', 'bus driver', 'driver details'],
            response: (s) => `The bus is ${s.busName}. You can find the driver's details in the 'Bus Details' card.`
        },
        {
            name: 'attendance',
            patterns: ['attendance', 'present', 'absent'],
            response: () => "You can view today's log and download the full attendance report from the 'Attendance Report' tab."
        },
        {
            name: 'greeting',
            patterns: ['hi', 'hello', 'hey'],
            response: () => "Hello! I'm GuardianBot. How can I help you today?"
        },
        {
            name: 'thanks',
            patterns: ['thank you', 'thanks'],
            response: () => "You're welcome! Let me know if there's anything else I can help with."
        },
        {
            name: 'help',
            patterns: ['help', 'what can you do', 'commands'],
            response: () => "I can answer questions about the bus location, ETA, driver details, and attendance. If you need to speak with a person, you can connect to an admin."
        }
    ];
    
    const detectIntent = (text: string): string => {
        const lowerCaseText = text.toLowerCase();
        for (const intent of intents) {
            if (intent.patterns.some(pattern => lowerCaseText.includes(pattern))) {
                return intent.response(student);
            }
        }
        return "I'm not sure how to answer that. For a list of commands, type 'help'. To speak with a person, type 'talk to admin'.";
    }
    
    const quickAccessButtons = [
      { icon: MapPin, label: 'Location', intent: 'location' },
      { icon: Clock, label: 'ETA', intent: 'eta' },
      { icon: User, label: 'Driver', intent: 'driver_info' },
      { icon: Bot, label: 'Attendance', intent: 'attendance' },
    ];

    useEffect(() => {
        const unsubscribe = onValue(chatDocRef, (snapshot) => {
            const data = snapshot.val();
            if (data && data.messages) {
                const history = Object.values(data.messages) as Message[];
                if (history.length > 0) {
                    setMessages(history);
                    const lastMessage = history[history.length - 1];
                    if (lastMessage?.sender === 'Admin' || (lastMessage?.sender === 'bot' && lastMessage?.text.includes("admin will attend shortly"))) {
                        setIsTalkingToAdmin(true);
                    }
                } else {
                    setMessages([ { id: Date.now(), sender: 'bot', text: "Chat history has been cleared by the admin." } ]);
                    setIsTalkingToAdmin(false);
                }
            } else {
                setMessages([initialMessage]);
            }
        });

        return () => unsubscribe();
    }, [chatDocRef]);


    const scrollToBottom = () => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({
                top: scrollAreaRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    
    const addMessageToDb = async (message: Message) => {
        try {
            const messageListRef = ref(db, `chats/${student.studentId}/messages`);
            const newMessageRef = push(messageListRef);
            await set(newMessageRef, message);
            await update(ref(db, `chats/${student.studentId}`), {
                lastMessageTimestamp: serverTimestamp(),
                unreadByAdmin: isTalkingToAdmin, // only set unread if it's for an admin
            });
        } catch (error) {
            console.error("Error sending message:", error);
            toast({
                variant: 'destructive',
                title: "Message Failed",
                description: "Could not send your message. Please try again."
            })
        }
    }

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage: Message = { 
            id: Date.now(), 
            sender: 'Parent', 
            text: input,
            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        };
        
        // Clear input immediately for better UX
        const currentInput = input;
        setInput('');

        await addMessageToDb(userMessage);
        
        if (!isTalkingToAdmin) {
            const lowerCaseInput = currentInput.toLowerCase();
            if (lowerCaseInput.includes('talk to admin')) {
                switchToAdminChat();
            } else {
                const botResponseText = detectIntent(lowerCaseInput);
                const botMessage: Message = { 
                    id: Date.now() + 1, 
                    sender: 'bot', 
                    text: botResponseText, 
                    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) 
                };
                
                setIsTyping(true);
                setTimeout(async () => {
                    await addMessageToDb(botMessage);
                    setIsTyping(false);
                }, 1200);
            }
        }
    };

    const handleQuickAccessClick = (intentName: string) => {
        if (isTalkingToAdmin) return;
        const intent = intents.find(i => i.name === intentName);
        if (!intent) return;
        
        const botResponse: Message = {
            id: Date.now(),
            text: intent.response(student),
            sender: 'bot',
            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        };
        
        setIsTyping(true);
        setTimeout(async () => {
            await addMessageToDb(botResponse);
            setIsTyping(false);
        }, 800);
    };

    const switchToAdminChat = async () => {
        const connectMessage: Message = {
             id: Date.now(),
             sender: 'bot',
             text: "I've connected you with an admin. They will attend to you shortly. Please type your message.",
             timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        };
        
        await addMessageToDb(connectMessage);
        setIsTalkingToAdmin(true);

        toast({
            title: "Connected to Admin",
            description: "An administrator has been notified and will join the chat soon.",
        });
    }

    const handleClearChat = async () => {
        await set(chatDocRef, { messages: null, unreadByAdmin: false });
        setMessages([initialMessage]);
        setIsTalkingToAdmin(false);
        setInput("");
        toast({
            title: "Chat Cleared",
            description: "Your conversation history has been cleared.",
        });
    };

    return (
        <Card className="mt-4">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {isTalkingToAdmin ? <User className="h-6 w-6 text-primary" /> : <Bot className="h-6 w-6 text-primary" />}
                        <CardTitle>Chat with {isTalkingToAdmin ? "Admin" : "GuardianBot"}</CardTitle>
                    </div>
                    {messages.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={handleClearChat} title="Clear Chat History">
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    )}
                </div>
                <CardDescription>
                    {isTalkingToAdmin ? "You are now connected to a live person." : "Get instant answers to your questions."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col h-[450px]">
                    <ScrollArea className="flex-grow p-4 border rounded-md" ref={scrollAreaRef}>
                        <div className="space-y-4">
                            {messages.map((message) => (
                                <div key={message.id} className={cn("flex items-start gap-3", message.sender === 'Parent' ? "justify-end" : "justify-start")}>
                                    {message.sender !== 'Parent' && (message.sender === 'bot' ? <Bot className="h-6 w-6 text-primary shrink-0" /> : <User className="h-6 w-6 text-muted-foreground shrink-0" />)}
                                    <div className={cn("p-3 rounded-lg max-w-[80%]", message.sender === 'Parent' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                                        <p className="text-sm">{message.text}</p>
                                        {message.timestamp && <p className="text-xs text-right mt-1 opacity-70">{message.timestamp}</p>}
                                    </div>
                                    {message.sender === 'Parent' && <User className="h-6 w-6 text-muted-foreground shrink-0" />}
                                </div>
                            ))}
                             {isTyping && (
                                <div className="flex items-start gap-3 justify-start">
                                    <Bot className="h-6 w-6 text-primary shrink-0" />
                                    <div className="p-3 rounded-lg bg-muted">
                                        <div className="flex items-center gap-1">
                                            <span className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="h-2 w-2 bg-primary rounded-full animate-bounce"></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    {!isTalkingToAdmin && (
                        <div className="mt-2 p-2 border-t">
                            <p className="text-xs text-muted-foreground mb-2 text-center">Quick Actions</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {quickAccessButtons.map((btn) => {
                                    const Icon = btn.icon;
                                    return (
                                        <Button 
                                            key={btn.intent} 
                                            variant="outline" 
                                            size="sm" 
                                            className="flex items-center justify-start gap-2"
                                            onClick={() => handleQuickAccessClick(btn.intent)}
                                        >
                                            <Icon className="h-4 w-4 text-primary" />
                                            <span className="text-xs">{btn.label}</span>
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className="mt-2 flex gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder={isTalkingToAdmin ? "Message the admin..." : "Type a message..."}
                        />
                        <Button onClick={handleSend} disabled={!input.trim() || isTyping}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                     <div className="mt-1 text-center">
                        {!isTalkingToAdmin && (
                             <Button variant="link" size="sm" onClick={() => switchToAdminChat()}>
                               <Phone className="mr-2 h-4 w-4" /> Talk to an Admin
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
