
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
import { PlusCircle } from 'lucide-react';
import busData from '@/lib/buses.json';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { db } from '@/lib/firebase';
import { ref, set, get } from 'firebase/database';
import { ScrollArea } from '../ui/scroll-area';


const studentSchema = z.object({
  studentId: z.string().regex(/^\d+$/, 'Student ID must be a number').min(1, 'Student ID is required'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  grade: z.string().min(1, 'Grade is required'),
  school: z.string().min(1, 'School is required'),
  section: z.string().min(1, 'Section is required'),
  age: z.coerce.number().int().positive('Age must be a positive number'),
  address: z.string().min(1, 'Address is required'),
  busId: z.string().min(1, 'Please select a bus'),
  specialAttention: z.boolean().default(false),
  specialInstructions: z.string().optional(),
  parentId: z.string(),
});

type StudentFormValues = z.infer<typeof studentSchema>;

const buses = Object.values(busData);

export function AddStudentForm() {
  const [isOpen, setIsOpen] = useState(false);
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
      busId: '',
      specialAttention: false,
      specialInstructions: '',
      parentId: '',
    },
  });

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
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
              <DialogDescription>
                Fill in the details below to register a new student. A parent login will be created automatically.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow my-4">
              <div className="space-y-4 pr-6">
                <FormField
                  control={form.control}
                  name="studentId"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Student ID</FormLabel>
                      <FormControl>
                          <Input placeholder="e.g., 60018230071" {...field} />
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
                      <FormLabel>Full Name (used for Parent ID)</FormLabel>
                      <FormControl>
                          <Input placeholder="Jane Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="age"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Age</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="10" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                        control={form.control}
                        name="grade"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Grade</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., 5th" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                </div>
                <FormField
                    control={form.control}
                    name="section"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Section</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., B" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField
                  control={form.control}
                  name="busId"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Assign Bus</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                          <SelectTrigger>
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
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                          <Input placeholder="123 Main St, Anytown" {...field} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="school"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>School</FormLabel>
                      <FormControl>
                          <Input {...field} disabled />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="specialAttention"
                  render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow">
                      <FormControl>
                          <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                          <FormLabel>
                          Requires Special Attention
                          </FormLabel>
                          <FormDescription>
                          Check this if the student needs special monitoring.
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
                        <FormLabel>Special Instructions / Medical Conditions</FormLabel>
                        <FormControl>
                        <Textarea
                            placeholder="e.g., Allergic to peanuts. Carries an EpiPen."
                            {...field}
                        />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                )}
              </div>
            </ScrollArea>
             <DialogFooter className="pt-4 flex-shrink-0">
                <Button type="submit">Create Student</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
