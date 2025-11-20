
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { GuardianTrackLogo } from '@/components/icons';
import Image from 'next/image';
import busData from '@/lib/buses.json';
import type { Bus } from '@/lib/data';
import { CheckCircle, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import staticParentCredentials from '@/lib/parent-credentials.json';
import staticStaffCredentials from '@/lib/staff-credentials.json';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  checkExistingSession, 
  createSession, 
  takeOverSession, 
  getDeviceInfo,
  type StaffSession 
} from '@/lib/session-manager';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


const getBusForStaff = (staffId: string): Bus | null => {
    return Object.values(busData).find(bus => bus.driver.name === staffId) || null;
}


export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [parentId, setParentId] = useState('');
  const [parentPassword, setParentPassword] = useState('');
  const [staffId, setStaffId] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [parentCredentials, setParentCredentials] = useState<Record<string, string>>({});
  const [staffCredentials, setStaffCredentials] = useState<Record<string, string>>({});
  const [existingSession, setExistingSession] = useState<StaffSession | null>(null);
  const [pendingStaffLogin, setPendingStaffLogin] = useState<{ staffId: string; busId: string } | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  useEffect(() => {
    const fetchCredentials = async () => {
        try {
            // Fetch Parent Credentials
            console.log("Fetching parent credentials...");
            const parentCredsRef = ref(db, 'parentCredentials');
            const parentSnapshot = await get(parentCredsRef);
            if (parentSnapshot.exists()) {
                console.log("Got parent credentials from Firebase");
                setParentCredentials(parentSnapshot.val());
            } else {
                console.log("No parent credentials in Firebase, using static data");
                setParentCredentials(staticParentCredentials);
            }

            // Fetch Staff Credentials
            console.log("Fetching staff credentials...");
            const staffCredsRef = ref(db, 'staffCredentials');
            const staffSnapshot = await get(staffCredsRef);
            if (staffSnapshot.exists()) {
                console.log("Got staff credentials from Firebase");
                setStaffCredentials(staffSnapshot.val());
            } else {
                console.log("No staff credentials in Firebase, using static data");
                setStaffCredentials(staticStaffCredentials);
            }
        } catch (error) {
            console.error("Error fetching credentials:", error);
            console.log("Falling back to static credentials");
            setParentCredentials(staticParentCredentials);
            setStaffCredentials(staticStaffCredentials);
        }
    };

    fetchCredentials();
  }, []);


  const handleAdminLogin = () => {
    if (adminId === 'Admin' && adminPassword === 'pass@123') {
      router.push('/dashboard');
    } else {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: 'Invalid admin credentials.',
      });
    }
  };

  const handleParentLogin = () => {
    console.log("Attempting parent login with ID:", parentId);
    console.log("Available parent credentials:", parentCredentials);
    if (parentCredentials[parentId] && parentCredentials[parentId] === parentPassword) {
      console.log("Parent login successful, setting local storage");
      localStorage.setItem('loggedInParentId', parentId);
      console.log("Redirecting to parent dashboard");
      router.push('/dashboard/parent');
    } else {
      console.log("Parent login failed - invalid credentials");
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: 'Invalid parent credentials.',
      });
    }
  };

  const handleStaffLogin = async () => {
    console.log("Attempting staff login with ID:", staffId);
    console.log("Available staff credentials:", staffCredentials);
    if (staffCredentials[staffId] && staffCredentials[staffId] === staffPassword) {
      console.log("Staff credentials valid, checking bus assignment");
      const bus = getBusForStaff(staffId);
      if (bus) {
        console.log("Found bus assignment:", bus.busId);
        
        // Check for existing session
        const existing = await checkExistingSession(staffId, bus.busId);
        if (existing) {
          console.log("Found existing session:", existing);
          setExistingSession(existing);
          setPendingStaffLogin({ staffId, busId: bus.busId });
          setShowDuplicateDialog(true);
        } else {
          // No existing session, proceed with login
          await proceedWithStaffLogin(staffId, bus.busId, true);
        }
      } else {
         console.log("No bus assignment found for staff member");
         toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: 'Could not find bus assignment for this staff member.',
         });
      }
    } else {
      console.log("Staff login failed - invalid credentials");
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: 'Invalid bus staff credentials.',
      });
    }
  };

  const proceedWithStaffLogin = async (staffId: string, busId: string, isPrimary: boolean) => {
    try {
      // Create session
      const sessionId = await createSession(staffId, busId, isPrimary);
      console.log("Session created:", sessionId);
      
      localStorage.setItem('loggedInStaffId', staffId);
      localStorage.setItem('loggedInStaffBusId', busId);
      localStorage.setItem('staffSessionId', sessionId);
      localStorage.setItem('isPrimarySession', isPrimary ? 'true' : 'false');
      
      toast({
        title: isPrimary ? 'Login Successful' : 'Logged In (Read-Only)',
        description: isPrimary 
          ? 'You have camera access for facial recognition.' 
          : 'You are in read-only mode. Camera is controlled by another device.',
      });
      
      console.log("Redirecting to staff dashboard");
      router.push('/dashboard/bus-staff');
    } catch (error) {
      console.error("Error creating session:", error);
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: 'Could not create session. Please try again.',
      });
    }
  };

  const handleTakeOver = async () => {
    if (!pendingStaffLogin || !existingSession) return;
    
    try {
      // Take over the existing session
      const newSessionId = await takeOverSession(
        pendingStaffLogin.staffId,
        pendingStaffLogin.busId,
        existingSession.sessionId
      );
      
      localStorage.setItem('loggedInStaffId', pendingStaffLogin.staffId);
      localStorage.setItem('loggedInStaffBusId', pendingStaffLogin.busId);
      localStorage.setItem('staffSessionId', newSessionId);
      localStorage.setItem('isPrimarySession', 'true');
      
      toast({
        title: 'Session Taken Over',
        description: 'You now have camera access. The other device has been logged out.',
      });
      
      setShowDuplicateDialog(false);
      router.push('/dashboard/bus-staff');
    } catch (error) {
      console.error("Error taking over session:", error);
      toast({
        variant: 'destructive',
        title: 'Failed to Take Over',
        description: 'Could not take over the session. Please try again.',
      });
    }
  };

  const handleReadOnly = async () => {
    if (!pendingStaffLogin) return;
    
    await proceedWithStaffLogin(pendingStaffLogin.staffId, pendingStaffLogin.busId, false);
    setShowDuplicateDialog(false);
  };

  const handleCancelLogin = () => {
    setShowDuplicateDialog(false);
    setPendingStaffLogin(null);
    setExistingSession(null);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gray-100 dark:bg-gray-900 p-4">
       <div className="absolute inset-0 z-0 bg-sky-100" />


      <div className="z-10 flex flex-col items-center">
        <Card className="w-full max-w-md shadow-2xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center">
                <div className="flex justify-center items-center gap-2 mb-2">
                    <GuardianTrackLogo className="h-12 w-12"/>
                    <CardTitle className="text-3xl">GuardianTrack</CardTitle>
                </div>
            <CardDescription>
                Welcome back! Please select your role to log in.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <Tabs defaultValue="parent" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="parent">Parent</TabsTrigger>
                <TabsTrigger value="staff">Bus Staff</TabsTrigger>
                <TabsTrigger value="admin">Admin</TabsTrigger>
                </TabsList>
                <TabsContent value="parent">
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                    <Label htmlFor="parent-id">Parent ID (Student's Name)</Label>
                    <Input
                        id="parent-id"
                        value={parentId}
                        onChange={(e) => setParentId(e.target.value)}
                        placeholder="Enter your child's name"
                    />
                    </div>
                    <div className="space-y-2">
                    <Label htmlFor="parent-password">Password</Label>
                    <Input
                        id="parent-password"
                        type="password"
                        value={parentPassword}
                        onChange={(e) => setParentPassword(e.target.value)}
                        placeholder="Enter your password"
                    />
                    </div>
                </div>
                <Button onClick={handleParentLogin} className="w-full">
                    Login as Parent
                </Button>
                </TabsContent>
                <TabsContent value="staff">
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                    <Label htmlFor="staff-id">Staff ID (Driver's Name)</Label>
                    <Input
                        id="staff-id"
                        value={staffId}
                        onChange={(e) => setStaffId(e.target.value)}
                        placeholder="Enter your full name"
                    />
                    </div>
                    <div className="space-y-2">
                    <Label htmlFor="staff-password">Password</Label>
                    <Input
                        id="staff-password"
                        type="password"
                        value={staffPassword}
                        onChange={(e) => setStaffPassword(e.target.value)}
                        placeholder="Enter your password"
                    />
                    </div>
                </div>
                <Button onClick={handleStaffLogin} className="w-full">
                    Login as Bus Staff
                </Button>
                </TabsContent>
                <TabsContent value="admin">
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                    <Label htmlFor="admin-id">ID</Label>
                    <Input
                        id="admin-id"
                        value={adminId}
                        onChange={(e) => setAdminId(e.target.value)}
                        placeholder="Admin"
                    />
                    </div>
                    <div className="space-y-2">
                    <Label htmlFor="admin-password">Password</Label>
                    <Input
                        id="admin-password"
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••"
                    />
                    </div>
                </div>
                <Button onClick={handleAdminLogin} className="w-full">
                    Login as Admin
                </Button>
                </TabsContent>
            </Tabs>
            </CardContent>
        </Card>

        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className="mt-6 bg-white/50 hover:bg-white/90 hover:shadow-lg transition-all duration-300 group">
                    <Info className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
                    Demo Credentials
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 sm:w-96">
                 <div className="text-left">
                    <h3 className="text-lg font-semibold mb-2 text-primary">Demo Credentials</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Use these credentials to log in and explore the different roles. The password for all accounts is <code className="font-mono bg-muted p-1 rounded">pass@123</code>.
                    </p>
                    <Tabs defaultValue="parent">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="parent">Parent</TabsTrigger>
                            <TabsTrigger value="staff">Bus Staff</TabsTrigger>
                            <TabsTrigger value="admin">Admin</TabsTrigger>
                        </TabsList>
                        <TabsContent value="parent">
                            <ScrollArea className='h-72'>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Parent ID (Child's Name)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.keys(parentCredentials).map(id => <TableRow key={id}><TableCell>{id}</TableCell></TableRow>)}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </TabsContent>
                         <TabsContent value="staff">
                            <ScrollArea className='h-72'>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Staff ID (Driver's Name)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.keys(staffCredentials).map(id => <TableRow key={id}><TableCell>{id}</TableCell></TableRow>)}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </TabsContent>
                         <TabsContent value="admin">
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Admin ID</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                     <TableRow><TableCell>Admin</TableCell></TableRow>
                                </TableBody>
                            </Table>
                        </TabsContent>
                    </Tabs>
                </div>
            </PopoverContent>
        </Popover>

      </div>
       <footer className="absolute bottom-4 text-center w-full z-10">
          <Link href="/about" className="text-sm text-gray-800 hover:text-primary bg-white/50 hover:bg-white/90 px-3 py-1 rounded-full transition-colors">
            About Us
          </Link>
        </footer>

      {/* Duplicate Session Dialog */}
      <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Already Logged In</AlertDialogTitle>
            <AlertDialogDescription>
              This staff account is already logged in on another device:
              <div className="mt-3 p-3 bg-muted rounded-md">
                <p className="font-semibold">Device: {existingSession?.deviceInfo}</p>
                <p className="text-sm text-muted-foreground">
                  Login Time: {existingSession ? new Date(existingSession.loginTime).toLocaleTimeString() : ''}
                </p>
                <p className="text-sm text-muted-foreground">
                  Last Active: {existingSession ? new Date(existingSession.lastActive).toLocaleTimeString() : ''}
                </p>
              </div>
              <p className="mt-3">
                You can take over the session (the other device will be logged out), 
                login as read-only (no camera access), or cancel.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleCancelLogin}>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={handleReadOnly}>
              Login Read-Only
            </Button>
            <AlertDialogAction onClick={handleTakeOver}>
              Take Over Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
