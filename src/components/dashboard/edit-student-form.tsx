
'use client';

import { useState, useEffect } from 'react';
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
import { Edit } from 'lucide-react';
import busData from '@/lib/buses.json';
import type { StudentJson as StudentType } from '@/lib/data';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';

const studentSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  grade: z.string().min(1, 'Grade is required'),
  school: z.string().min(1, 'School is required'),
  address: z.string().min(1, 'Address is required'),
  busId: z.string().min(1, 'Please select a bus'),
  profilePhotos: z.any().optional(),
  specialAttention: z.boolean().default(false),
  specialInstructions: z.string().optional(),
});

type StudentFormValues = z.infer<typeof studentSchema>;

const buses = Object.values(busData);

interface EditStudentFormProps {
  student: StudentType;
  children: React.ReactNode;
}

export function EditStudentForm({ student, children }: EditStudentFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      ...student,
      profilePhotos: undefined, // Clear file input on open
      specialAttention: student.specialAttention || false,
      specialInstructions: student.specialInstructions || '',
    },
  });

  const specialAttention = form.watch('specialAttention');

  useEffect(() => {
    if (isOpen) {
      form.reset({
        ...student,
        profilePhotos: undefined,
        specialAttention: student.specialAttention || false,
        specialInstructions: student.specialInstructions || '',
      });
    }
  }, [student, form, isOpen]);

  const onSubmit = (data: StudentFormValues) => {
    // In a real app, you would upload the file to a server.
    if (data.profilePhotos && data.profilePhotos.length > 0) {
        const files = data.profilePhotos as FileList;
        console.log('Updated Student Data:', data);
        console.log(`Simulating file upload: Saving ${files.length} new files.`);
         toast({
            title: 'Student Updated Successfully',
            description: `${data.name}'s details have been updated. ${files.length} new photos are ready for processing.`,
            className: 'bg-accent text-accent-foreground border-accent',
        });
    } else {
         console.log('Updated Student Data (no new photo):', data);
         toast({
            title: 'Student Updated Successfully',
            description: `${data.name}'s details have been updated.`,
            className: 'bg-accent text-accent-foreground border-accent',
        });
    }

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Student Details</DialogTitle>
          <DialogDescription>
            Update the student's information below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 p-4">
                <FormField
                control={form.control}
                name="studentId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Student ID</FormLabel>
                    <FormControl>
                        <Input {...field} disabled />
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
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                        <Input placeholder="Jane Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                    control={form.control}
                    name="profilePhotos"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Update Profile Photos</FormLabel>
                            <FormControl>
                                <Input 
                                    type="file" 
                                    accept="image/png, image/jpeg"
                                    multiple
                                    onChange={(e) => {
                                    if (e.target.files) {
                                        field.onChange(e.target.files);
                                    }
                                    }}
                                />
                            </FormControl>
                            <FormDescription>
                                Leave blank to keep the current photos.
                            </FormDescription>
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
                        <Input placeholder="e.g., 5th Standard" {...field} />
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
                            value={field.value ?? ''}
                        />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                )}
                </div>
            </ScrollArea>
            <DialogFooter className="pt-4 px-4">
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
