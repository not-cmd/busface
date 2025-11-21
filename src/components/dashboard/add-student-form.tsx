
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, MapPin } from 'lucide-react';
import busData from '@/lib/buses.json';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { db } from '@/lib/firebase';
import { ref, set, get } from 'firebase/database';
import { ScrollArea } from '../ui/scroll-area';
import { AddressAutocomplete } from './address-autocomplete';
import { LocationMapPreview } from './location-map-preview';


const studentSchema = z.object({
  studentId: z.string().regex(/^\d+$/, 'Student ID must be a number').min(1, 'Student ID is required'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  grade: z.string().min(1, 'Grade is required'),
  school: z.string().min(1, 'School is required'),
  section: z.string().min(1, 'Section is required'),
  age: z.coerce.number().int().positive('Age must be a positive number'),
  address: z.string().min(1, 'Address is required'),
  homeLocation: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  busId: z.string().min(1, 'Please select a bus'),
  specialAttention: z.boolean().default(false),
  specialInstructions: z.string().optional(),
  parentId: z.string(),
});

type StudentFormValues = z.infer<typeof studentSchema>;

const buses = Object.values(busData);

export function AddStudentForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const { toast } = useToast();

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      studentId: '',
      name: '',
      grade: '',
      section: '',
      age: '' as any, // Initialize with empty string to avoid uncontrolled to controlled error
      school: 'Greenfield Public School',
      address: '',
      homeLocation: undefined,
      busId: '',
      specialAttention: false,
      specialInstructions: '',
      parentId: '',
    },
  });

  // Handle location selection from autocomplete
  const handleLocationSelect = (location: { lat: number; lng: number; address: string }) => {
    setSelectedLocation(location);
    form.setValue('homeLocation', { lat: location.lat, lng: location.lng });
    form.setValue('address', location.address);
  };

  const studentName = form.watch('name');
  form.setValue('parentId', studentName);

  const specialAttention = form.watch('specialAttention');

  const onSubmit = async (data: StudentFormValues) => {
    try {
        // 1. Create the student record in /students
        const studentRef = ref(db, `students/${data.studentId}`);
        const newStudent = {
            ...data,
            profilePhotos: ["https://placehold.co/100x100.png"], // Add a default placeholder
            status: "Not Boarded"
        };
        await set(studentRef, newStudent);

        // 2. Auto-generate parent credentials and save to RTDB
        const parentCredentialsRef = ref(db, `parentCredentials/${data.parentId}`);
        await set(parentCredentialsRef, 'pass@123');
        
        toast({
            title: 'Student Created Successfully',
            description: `${data.name} has been added and parent login has been created.`,
            className: 'bg-accent text-accent-foreground border-accent',
        });

        form.reset();
        setSelectedLocation(null);
        setIsOpen(false);
    } catch(error) {
        console.error("Error creating student:", error);
        toast({
            variant: "destructive",
            title: 'Creation Failed',
            description: 'Could not save student data to the database.',
        });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1">
          <PlusCircle className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            Add Student
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Add New Student</DialogTitle>
              <DialogDescription className="text-base">
                Fill in the details below to register a new student. A parent login will be created automatically with username as student name and password: <span className="font-semibold text-foreground">pass@123</span>
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow my-6">
              <div className="space-y-5 pr-6">
                {/* Personal Information Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Personal Information</h3>
                  <FormField
                    control={form.control}
                    name="studentId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-base">Student ID *</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., 60018230071" className="h-11" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-base">Full Name *</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Jane Doe" className="h-11" {...field} />
                        </FormControl>
                        <FormDescription>This will be used as the Parent Login ID</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                  />
                </div>
                
                {/* Academic Information Section */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Academic Information</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="grade"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="text-base">Class/Grade *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger className="h-11">
                                    <SelectValue placeholder="Select class" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                <SelectItem value="Nursery">Nursery</SelectItem>
                                <SelectItem value="LKG">LKG</SelectItem>
                                <SelectItem value="UKG">UKG</SelectItem>
                                <SelectItem value="1st">1st</SelectItem>
                                <SelectItem value="2nd">2nd</SelectItem>
                                <SelectItem value="3rd">3rd</SelectItem>
                                <SelectItem value="4th">4th</SelectItem>
                                <SelectItem value="5th">5th</SelectItem>
                                <SelectItem value="6th">6th</SelectItem>
                                <SelectItem value="7th">7th</SelectItem>
                                <SelectItem value="8th">8th</SelectItem>
                                <SelectItem value="9th">9th</SelectItem>
                                <SelectItem value="10th">10th</SelectItem>
                                <SelectItem value="11th">11th</SelectItem>
                                <SelectItem value="12th">12th</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                      control={form.control}
                      name="section"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel className="text-base">Section *</FormLabel>
                          <FormControl>
                              <Input placeholder="e.g., A" className="h-11" {...field} />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="age"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel className="text-base">Age *</FormLabel>
                          <FormControl>
                              <Input type="number" placeholder="10" className="h-11" {...field} />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="school"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-base">School</FormLabel>
                        <FormControl>
                            <Input {...field} disabled className="h-11 bg-muted" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                  />
                </div>

                {/* Transportation & Location Section */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Transportation & Location</h3>
                  <FormField
                    control={form.control}
                    name="busId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-base">Assign Bus *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger className="h-11">
                                <SelectValue placeholder="Select a bus" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {buses.map((bus) => (
                                <SelectItem key={bus.busId} value={bus.busId}>
                                {bus.name}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-base">Home Address *</FormLabel>
                        <FormControl>
                            <AddressAutocomplete
                              value={field.value}
                              onChange={field.onChange}
                              onLocationSelect={handleLocationSelect}
                              placeholder="Start typing address (e.g., 123 Main St, Mumbai)"
                            />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                  />
                  
                  {/* Map Preview */}
                  {selectedLocation && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>Home location preview</span>
                      </div>
                      <LocationMapPreview location={selectedLocation} height="180px" />
                    </div>
                  )}
                </div>

                {/* Special Care Section */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Special Care</h3>
                  <FormField
                    control={form.control}
                    name="specialAttention"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border-2 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
                        <FormControl>
                            <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-0.5"
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel className="text-base font-semibold">
                            Requires Special Attention
                            </FormLabel>
                            <FormDescription>
                            Check this if the student needs special monitoring or has medical conditions.
                            </FormDescription>
                        </div>
                        </FormItem>
                    )}
                  />
                  {specialAttention && (
                  <FormField
                      control={form.control}
                      name="specialInstructions"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel className="text-base">Special Instructions / Medical Conditions *</FormLabel>
                          <FormControl>
                          <Textarea
                              placeholder="e.g., Allergic to peanuts. Carries an EpiPen. Requires assistance boarding."
                              className="min-h-[100px] resize-none"
                              {...field}
                          />
                          </FormControl>
                          <FormDescription>Provide detailed information for staff awareness</FormDescription>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  )}
                </div>
              </div>
            </ScrollArea>
             <DialogFooter className="pt-6 flex-shrink-0 border-t">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="h-11">
                  Cancel
                </Button>
                <Button type="submit" className="h-11 px-8">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create Student
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
