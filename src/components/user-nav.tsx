'use client';

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
  } from "@/components/ui/avatar"
  import { Button } from "@/components/ui/button"
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu"
  import { User, Settings, LogOut } from "lucide-react"
  import Link from "next/link"
  import { useRouter } from "next/navigation"
  import { NotificationBell } from "@/components/notification-bell"
  import { removeSession } from "@/lib/session-manager"
  
  interface UserNavProps {
    userId?: string
  }
  
  export function UserNav({ userId = "default-user" }: UserNavProps) {
    const router = useRouter();

    const handleLogout = async (e?: React.MouseEvent) => {
      // Prevent event propagation
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      console.log('Logout initiated...');
      
      try {
        // Clean up session before logout
        const sessionId = localStorage.getItem('staffSessionId');
        const busId = localStorage.getItem('loggedInStaffBusId');
        
        if (sessionId && busId) {
          try {
            await removeSession(busId, sessionId);
            console.log('Session removed successfully');
          } catch (error) {
            console.error('Error removing session:', error);
          }
        }
        
        // Clear all localStorage
        localStorage.removeItem('loggedInStaffId');
        localStorage.removeItem('loggedInStaffBusId');
        localStorage.removeItem('staffSessionId');
        localStorage.removeItem('isPrimarySession');
        
        console.log('localStorage cleared, redirecting to login...');
        
        // Force redirect to login using window.location as fallback
        try {
          await router.push('/login');
        } catch (routerError) {
          console.error('Router push failed, using window.location:', routerError);
          window.location.href = '/login';
        }
      } catch (error) {
        console.error('Error during logout:', error);
        // Fallback: force redirect even if there's an error
        window.location.href = '/login';
      }
    };

    return (
      <div className="flex items-center gap-2">
        <NotificationBell userId={userId} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://placehold.co/40x40.png" alt="@user" data-ai-hint="person" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">User</p>
                <p className="text-xs leading-none text-muted-foreground">
                  user@guardiantrack.com
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
                <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
                <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
                onClick={(e) => handleLogout(e)}
                onSelect={(e) => {
                  e.preventDefault();
                  handleLogout();
                }}
            >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
                <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }
  