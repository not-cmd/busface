
'use client';

import type { StudentJson as Student } from '@/lib/data';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { User, GraduationCap, Home } from 'lucide-react';

interface StudentIdCardProps {
    student: Student;
}

export function StudentIdCard({ student }: StudentIdCardProps) {
    return (
        <Card className="font-headline shadow-lg bg-gray-50 border-gray-200 overflow-hidden">
            <CardContent className="p-0">
                <div className="bg-blue-100/50 p-4 text-center">
                    <div className="inline-block p-1 bg-white rounded-full shadow-md">
                        <Image
                            src={student.profilePhotos[0]}
                            alt={`Photo of ${student.name}`}
                            width={80}
                            height={80}
                            className="rounded-full"
                            data-ai-hint="child smiling"
                        />
                    </div>
                </div>
                <div className="p-4 space-y-3">
                    <div className="bg-yellow-100/60 p-3 rounded-lg shadow-sm border border-yellow-200/80">
                        <div className="flex items-center gap-3">
                            <User className="h-5 w-5 text-yellow-700" />
                            <div>
                                <p className="text-xs text-yellow-800/80 font-semibold">Name</p>
                                <p className="font-bold text-yellow-900 text-lg">{student.name}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-pink-100/60 p-3 rounded-lg shadow-sm border border-pink-200/80">
                         <div className="flex items-center gap-3">
                            <GraduationCap className="h-5 w-5 text-pink-700" />
                            <div>
                                <p className="text-xs text-pink-800/80 font-semibold">Grade</p>
                                <p className="font-bold text-pink-900">{student.grade}, Section {student.section}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-sky-100/60 p-3 rounded-lg shadow-sm border border-sky-200/80">
                         <div className="flex items-center gap-3">
                            <Home className="h-5 w-5 text-sky-700" />
                            <div>
                                <p className="text-xs text-sky-800/80 font-semibold">Address</p>
                                <p className="font-medium text-sky-900 text-sm">{student.address}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
