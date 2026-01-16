'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Protected } from './auth/Protected';
import { AppShell } from './components/AppShell';
import { SummaryCard } from './components/SummaryCard';
import { useAuth } from './auth/AuthProvider';
import { apiFetch } from './apiClient';

type DrivingSchool = { id: number; name: string; active: boolean };
type Booking = { id: number; startTime: string; status: string; studentId?: number; driverId?: number };
type StudentProfile = { id: number; fullName: string; licenceStatus: string; allowedHours?: number | null };
type DriverProfile = { id: number; fullName: string; active: boolean };
type Invitation = { id: number; email: string; role: string; status: string };

// Superadmin Overview
function SuperadminOverview({ token }: { token: string }) {
  const [schools, setSchools] = useState<DrivingSchool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<DrivingSchool[]>('/schools', token);
        setSchools(data);
      } catch (err) {
        console.error('Failed to load schools');
      }
      setLoading(false);
    }
    load();
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, Superadmin</h1>
        <p className="text-slate-600">Platform overview and quick actions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard title="🏫 Driving Schools" description="Total registered schools" footer={loading ? 'Loading...' : ''}>
          <div className="text-4xl font-bold text-blue-600">{schools.length}</div>
          <p className="text-sm text-slate-500">{schools.filter(s => s.active).length} active</p>
        </SummaryCard>

        <SummaryCard title="⚡ Quick Actions" description="Common tasks" footer="">
          <div className="space-y-2">
            <Link href="/superadmin" className="block w-full text-left px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-800">
              → Manage Schools
            </Link>
            <Link href="/admin" className="block w-full text-left px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-800">
              → School Admin View
            </Link>
          </div>
        </SummaryCard>

        <SummaryCard title="📊 System Status" description="Platform health" footer="">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-sm">All systems operational</span>
          </div>
        </SummaryCard>
      </div>
    </div>
  );
}

// School Admin Overview
function AdminOverview({ token, schoolId }: { token: string; schoolId: number }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [bookingData, studentData, driverData, invitationData] = await Promise.all([
          apiFetch<Booking[]>(`/schools/${schoolId}/bookings?status=upcoming`, token).catch(() => []),
          apiFetch<StudentProfile[]>(`/schools/${schoolId}/students`, token).catch(() => []),
          apiFetch<DriverProfile[]>(`/schools/${schoolId}/drivers`, token).catch(() => []),
          apiFetch<Invitation[]>(`/schools/${schoolId}/invitations`, token).catch(() => []),
        ]);
        setBookings(bookingData);
        setStudents(studentData);
        setDrivers(driverData);
        setInvitations(invitationData);
      } catch (err) {
        console.error('Failed to load admin data');
      }
      setLoading(false);
    }
    load();
  }, [token, schoolId]);

  const todayBookings = bookings.filter(b => {
    const bookingDate = new Date(b.startTime).toDateString();
    return bookingDate === new Date().toDateString();
  });

  const pendingLicences = students.filter(s => s.licenceStatus === 'pending_review');
  const pendingInvitations = invitations.filter(i => i.status === 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">School Admin Dashboard</h1>
        <p className="text-slate-600">Today's overview and quick actions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard title="📅 Today's Lessons" description="Scheduled for today" footer="">
          <div className="text-4xl font-bold text-blue-600">{todayBookings.length}</div>
          <p className="text-sm text-slate-500">{bookings.length} total upcoming</p>
        </SummaryCard>

        <SummaryCard title="📋 Pending Reviews" description="Licences awaiting review" footer="">
          <div className="text-4xl font-bold text-orange-500">{pendingLicences.length}</div>
          {pendingLicences.length > 0 && (
            <Link href="/admin" className="text-sm text-blue-600 hover:underline">Review now →</Link>
          )}
        </SummaryCard>

        <SummaryCard title="📧 Pending Invites" description="Awaiting acceptance" footer="">
          <div className="text-4xl font-bold text-purple-600">{pendingInvitations.length}</div>
        </SummaryCard>

        <SummaryCard title="👥 Team" description="Active members" footer="">
          <div className="text-sm space-y-1">
            <p><strong>{students.length}</strong> students</p>
            <p><strong>{drivers.filter(d => d.active).length}</strong> drivers</p>
          </div>
        </SummaryCard>
      </div>

      <SummaryCard title="⚡ Quick Actions" description="" footer="">
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="px-4 py-2 rounded bg-slate-900 text-white text-sm hover:bg-slate-800">
            Manage School
          </Link>
          <Link href="/bookings" className="px-4 py-2 rounded bg-slate-100 text-slate-700 text-sm hover:bg-slate-200">
            View All Bookings
          </Link>
        </div>
      </SummaryCard>
    </div>
  );
}

// Driver Overview
function DriverOverview({ token, schoolId }: { token: string; schoolId: number }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [bookingData, studentData] = await Promise.all([
          apiFetch<Booking[]>(`/schools/${schoolId}/bookings?status=upcoming`, token).catch(() => []),
          apiFetch<StudentProfile[]>(`/schools/${schoolId}/students`, token).catch(() => []),
        ]);
        setBookings(bookingData);
        setStudents(studentData);
      } catch (err) {
        console.error('Failed to load driver data');
      }
      setLoading(false);
    }
    load();
  }, [token, schoolId]);

  const todayBookings = bookings.filter(b => {
    const bookingDate = new Date(b.startTime).toDateString();
    return bookingDate === new Date().toDateString();
  }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const nextLesson = todayBookings[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Driver Dashboard</h1>
        <p className="text-slate-600">Your schedule overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard title="📅 Today's Lessons" description="Your schedule for today" footer="">
          <div className="text-4xl font-bold text-blue-600">{todayBookings.length}</div>
          {nextLesson && (
            <p className="text-sm text-slate-500">
              Next: {new Date(nextLesson.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </SummaryCard>

        <SummaryCard title="📆 This Week" description="Upcoming lessons" footer="">
          <div className="text-4xl font-bold text-green-600">{bookings.length}</div>
          <p className="text-sm text-slate-500">total scheduled</p>
        </SummaryCard>

        <SummaryCard title="⚡ Quick Actions" description="" footer="">
          <Link href="/driver" className="block w-full text-center px-4 py-2 rounded bg-slate-900 text-white text-sm hover:bg-slate-800">
            View Full Schedule
          </Link>
        </SummaryCard>
      </div>

      {todayBookings.length > 0 && (
        <SummaryCard title="🚗 Today's Schedule" description="" footer="">
          <ul className="space-y-2">
            {todayBookings.slice(0, 5).map(booking => {
              const student = students.find(s => s.id === booking.studentId);
              return (
                <li key={booking.id} className="flex justify-between items-center p-3 bg-slate-50 rounded border">
                  <div>
                    <p className="font-medium">{new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="text-sm text-slate-500">{student?.fullName || 'Student'}</p>
                  </div>
                  <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">{booking.status}</span>
                </li>
              );
            })}
          </ul>
        </SummaryCard>
      )}
    </div>
  );
}

// Student Overview
function StudentOverview({ token, schoolId }: { token: string; schoolId: number }) {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [usedHours, setUsedHours] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const studentData = await apiFetch<StudentProfile[]>(`/schools/${schoolId}/students`, token).catch(() => []);
        const activeStudent = studentData[0] || null;
        setStudent(activeStudent);

        if (activeStudent) {
          const [bookingData, usageData] = await Promise.all([
            apiFetch<Booking[]>(`/schools/${schoolId}/bookings?status=upcoming`, token).catch(() => []),
            apiFetch<{ usedHours: number }>(`/schools/${schoolId}/students/${activeStudent.id}/usage`, token).catch(() => ({ usedHours: 0 })),
          ]);
          setBookings(bookingData.filter(b => b.studentId === activeStudent.id));
          setUsedHours(usageData.usedHours);
        }
      } catch (err) {
        console.error('Failed to load student data');
      }
      setLoading(false);
    }
    load();
  }, [token, schoolId]);

  const allowedHours = student?.allowedHours ?? null;
  const remainingHours = allowedHours !== null ? Math.max(0, allowedHours - usedHours) : null;
  const hoursPercent = allowedHours ? Math.min(100, (usedHours / allowedHours) * 100) : 0;

  const nextLesson = bookings.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {student?.fullName || 'Student'}</h1>
        <p className="text-slate-600">Your learning progress and upcoming lessons.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Hours Summary */}
        <SummaryCard title="⏱️ Your Hours" description="Booking hours summary" footer="">
          <div className="space-y-3">
            {allowedHours !== null ? (
              <>
                <div className="flex justify-between text-sm">
                  <span>Used</span>
                  <span className="font-bold">{usedHours.toFixed(1)} hrs</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${hoursPercent > 80 ? 'bg-red-500' : 'bg-blue-600'}`}
                    style={{ width: `${hoursPercent}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Remaining</span>
                  <span className="font-bold text-green-600">{remainingHours?.toFixed(1)} hrs</span>
                </div>
                <p className="text-xs text-slate-500 text-center">of {allowedHours} total hours</p>
              </>
            ) : (
              <div className="text-center py-2">
                <p className="text-2xl font-bold text-blue-600">{usedHours.toFixed(1)} hrs</p>
                <p className="text-sm text-slate-500">used (no limit set)</p>
              </div>
            )}
          </div>
        </SummaryCard>

        {/* Next Lesson */}
        <SummaryCard title="📅 Next Lesson" description="Your upcoming lesson" footer="">
          {nextLesson ? (
            <div className="text-center py-2">
              <p className="text-lg font-bold">{new Date(nextLesson.startTime).toLocaleDateString()}</p>
              <p className="text-2xl font-bold text-blue-600">
                {new Date(nextLesson.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-sm text-slate-500 mt-1">{bookings.length} total upcoming</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-slate-500">No lessons scheduled</p>
              <Link href="/student" className="text-blue-600 text-sm hover:underline">Book a lesson →</Link>
            </div>
          )}
        </SummaryCard>

        {/* Licence Status */}
        <SummaryCard title="📋 Licence Status" description="Your verification status" footer="">
          <div className="text-center py-2">
            <span className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${student?.licenceStatus === 'approved' ? 'bg-green-100 text-green-800' :
              student?.licenceStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
              {student?.licenceStatus === 'approved' ? '✓ Approved' :
                student?.licenceStatus === 'rejected' ? '✗ Rejected' :
                  '⏳ Pending Review'}
            </span>
            {student?.licenceStatus !== 'approved' && (
              <Link href="/student" className="block text-blue-600 text-sm hover:underline mt-2">
                Update licence →
              </Link>
            )}
          </div>
        </SummaryCard>
      </div>

      <SummaryCard title="⚡ Quick Actions" description="" footer="">
        <div className="flex flex-wrap gap-2">
          <Link href="/student" className="px-4 py-2 rounded bg-slate-900 text-white text-sm hover:bg-slate-800">
            Book a Lesson
          </Link>
          <Link href="/student" className="px-4 py-2 rounded bg-slate-100 text-slate-700 text-sm hover:bg-slate-200">
            Manage Addresses
          </Link>
        </div>
      </SummaryCard>
    </div>
  );
}

export default function Home() {
  const { user, token, loading } = useAuth();
  const schoolId = useMemo(() => user?.schoolId, [user?.schoolId]);

  if (loading) {
    return (
      <Protected>
        <AppShell>
          <div className="flex items-center justify-center min-h-[200px]">
            <p className="text-slate-500">Loading...</p>
          </div>
        </AppShell>
      </Protected>
    );
  }

  const role = user?.role?.toLowerCase();

  return (
    <Protected>
      <AppShell>
        {role === 'superadmin' && token && <SuperadminOverview token={token} />}
        {role === 'school_admin' && token && schoolId && <AdminOverview token={token} schoolId={schoolId} />}
        {role === 'driver' && token && schoolId && <DriverOverview token={token} schoolId={schoolId} />}
        {role === 'student' && token && schoolId && <StudentOverview token={token} schoolId={schoolId} />}
        {!role && (
          <div className="text-center py-10">
            <p className="text-slate-500">Please log in to see your dashboard.</p>
          </div>
        )}
      </AppShell>
    </Protected>
  );
}
