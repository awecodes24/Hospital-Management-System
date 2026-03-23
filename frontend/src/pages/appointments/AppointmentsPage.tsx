import { useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Calendar, PlusCircle, Clock, Search, X, Stethoscope } from 'lucide-react';
import {
  useTodaysAppointments, useAppointmentsByDate, useDoctors, usePatients,
  useBookAppointment, useUpdateAppointmentStatus,
} from '@/hooks';
import {
  SectionHeader, Button, Modal, Select, Textarea,
  Table, Tr, Td, StatusBadge, PageLoader, EmptyState
} from '@/components/shared';
import { formatDate, formatTime } from '@/lib/utils';
import type { AppointmentStatus, Patient, Doctor } from '@/types';

const STATUS_OPTIONS = ['Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No-Show'].map(s => ({ value: s, label: s }));

// ── Reusable search picker that renders dropdown via fixed positioning ─────────
function SearchPicker<T>({
  label, placeholder, icon, value, onSelect, onClear,
  items, renderItem, renderSelected, filterFn, loading,
}: {
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  value: T | null;
  onSelect: (item: T) => void;
  onClear: () => void;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  renderSelected: (item: T) => string;
  filterFn: (item: T, query: string) => boolean;
  loading?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync query when value is cleared externally
  useEffect(() => {
    if (!value) setQuery('');
    else setQuery(renderSelected(value));
  }, [value]);

  // Position dropdown using fixed coords from input bounds
  const updateDropPosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (open) {
      updateDropPosition();
      window.addEventListener('scroll', updateDropPosition, true);
      window.addEventListener('resize', updateDropPosition);
    }
    return () => {
      window.removeEventListener('scroll', updateDropPosition, true);
      window.removeEventListener('resize', updateDropPosition);
    };
  }, [open, updateDropPosition]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Also check if click is inside the fixed dropdown
        const drop = document.getElementById('search-picker-drop');
        if (drop && drop.contains(e.target as Node)) return;
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const filtered = query && !value ? items.filter(i => filterFn(i, query)) : items;

  return (
    <div ref={containerRef}>
      <label className="block text-xs font-medium text-[#4A5568] mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5568] pointer-events-none">
          {icon}
        </span>
        <input
          ref={inputRef}
          value={query}
          readOnly={!!value}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (!value) setOpen(true); updateDropPosition(); }}
          placeholder={placeholder}
          className="w-full bg-[#F0F4F8] rounded-lg px-3 py-2.5 text-sm text-[#1A2332] outline-none pl-9 pr-9 focus:bg-[#E8EEF4] focus:ring-1 focus:ring-[#006B58]/30 placeholder:text-[#4A5568]"
          autoComplete="off"
        />
        {(query || value) && (
          <button
            type="button"
            onClick={() => { onClear(); setQuery(''); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5568] hover:text-[#1A2332] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Fixed-position dropdown — renders outside modal scroll context */}
      {open && !value && query && (
        <div id="search-picker-drop" style={dropStyle}
          className="bg-white rounded-xl shadow-2xl border border-[#C0C8BB]/20 overflow-hidden max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-xs text-[#4A5568] text-center">No results found</p>
          ) : filtered.slice(0, 8).map((item, i) => (
            <button key={i} type="button"
              onMouseDown={() => { onSelect(item); setQuery(renderSelected(item)); setOpen(false); }}
              className="w-full text-left hover:bg-[#F0F4F8] transition-colors">
              {renderItem(item)}
            </button>
          ))}
        </div>
      )}

      {/* Selected pill */}
      {value && (
        <div className="mt-1.5 flex items-center gap-2 bg-[#006B58]/10 rounded-lg px-3 py-1.5 w-fit">
          <span className="text-xs font-medium text-[#006B58]">{renderSelected(value)}</span>
          <button type="button" onClick={() => { onClear(); setQuery(''); }}
            className="text-[#006B58]/60 hover:text-[#006B58]"><X className="w-3 h-3" /></button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AppointmentsPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(today);
  const [showBook, setShowBook] = useState(false);
  const [showStatus, setShowStatus] = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState<AppointmentStatus>('Confirmed');
  const [statusNotes, setStatusNotes] = useState('');
  const [formError, setFormError] = useState('');

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [form, setForm] = useState({ date: today, time: '09:00', reason: '' });

  const isToday = selectedDate === today;
  const { data: todayAppts, isLoading: loadToday } = useTodaysAppointments();
  const { data: dateAppts, isLoading: loadDate } = useAppointmentsByDate(isToday ? '' : selectedDate);
  const { data: doctors } = useDoctors();
  const { data: patients } = usePatients({ limit: 200, search: patientQuery || undefined });
  const bookMutation = useBookAppointment();
  const statusMutation = useUpdateAppointmentStatus();

  const appointments = isToday ? todayAppts : dateAppts;
  const isLoading = isToday ? loadToday : loadDate;

  function resetForm() {
    setSelectedPatient(null);
    setSelectedDoctor(null);
    setPatientQuery('');
    setForm({ date: today, time: '09:00', reason: '' });
    setFormError('');
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!selectedPatient) { setFormError('Please select a patient.'); return; }
    if (!selectedDoctor) { setFormError('Please select a doctor.'); return; }
    try {
      await bookMutation.mutateAsync({
        patient_id: selectedPatient.patient_id,
        doctor_id: selectedDoctor.doctor_id,
        date: form.date,
        time: form.time,
        reason: form.reason || undefined,
      });
      setShowBook(false);
      resetForm();
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'Failed to book appointment.');
    }
  }

  async function handleStatusUpdate() {
    if (!showStatus) return;
    await statusMutation.mutateAsync({ id: showStatus, status: newStatus, notes: statusNotes || undefined });
    setShowStatus(null);
    setStatusNotes('');
  }

  return (
    <div>
      <SectionHeader
        title="Appointments"
        description="View and manage patient appointments"
        action={<Button icon={<PlusCircle className="w-4 h-4" />} onClick={() => { resetForm(); setShowBook(true); }}>Book Appointment</Button>}
      />

      {/* Date picker */}
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-4 h-4 text-[#4A5568]" />
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="input w-auto text-sm" />
        {selectedDate !== today && <Button variant="ghost" size="sm" onClick={() => setSelectedDate(today)}>Today</Button>}
        <span className="text-sm text-[#4A5568]">{isToday ? "Today's Appointments" : formatDate(selectedDate)}</span>
      </div>

      {/* Table */}
      <div className="card">
        {isLoading ? <PageLoader /> : (
          <>
            <Table headers={['Time', 'Patient', 'Doctor', 'Reason', 'Status', '']}>
              {(appointments as any[])?.map((appt: any) => (
                <Tr key={appt.appointment_id}>
                  <Td><span className="font-mono text-xs font-medium text-[#006B58]">{formatTime(appt.appointment_time)}</span></Td>
                  <Td>
                    <p className="font-medium">{appt.patient_name}</p>
                    <p className="text-xs text-[#4A5568]">{appt.patient_phone}</p>
                  </Td>
                  <Td>
                    <p>Dr. {appt.doctor_name}</p>
                    <p className="text-xs text-[#4A5568]">{appt.specialization ?? appt.department}</p>
                  </Td>
                  <Td className="text-[#4A5568] text-xs max-w-[160px] truncate">{appt.reason ?? '—'}</Td>
                  <Td><StatusBadge status={appt.status} /></Td>
                  <Td>
                    <button onClick={() => { setShowStatus(appt.appointment_id); setNewStatus(appt.status); }}
                      className="text-xs text-[#006B58] hover:underline">Update</button>
                  </Td>
                </Tr>
              ))}
            </Table>
            {(!appointments || (appointments as any[]).length === 0) && (
              <EmptyState icon={<Clock className="w-8 h-8" />} title="No appointments"
                description={`No appointments scheduled for ${isToday ? 'today' : formatDate(selectedDate)}.`} />
            )}
          </>
        )}
      </div>

      {/* Book modal */}
      <Modal open={showBook} onClose={() => { setShowBook(false); resetForm(); }} title="Book Appointment" size="md">
        <form onSubmit={handleBook} className="space-y-5">

          <SearchPicker<Patient>
            label="Patient *"
            placeholder="Search by name or phone…"
            icon={<Search className="w-3.5 h-3.5" />}
            value={selectedPatient}
            onSelect={p => setSelectedPatient(p)}
            onClear={() => setSelectedPatient(null)}
            items={patients?.data ?? []}
            filterFn={(p, q) => `${p.first_name} ${p.last_name} ${p.phone}`.toLowerCase().includes(q.toLowerCase())}
            renderSelected={p => `${p.first_name} ${p.last_name} — #${p.patient_id}`}
            renderItem={p => (
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-7 h-7 rounded-full bg-[#006B58]/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-[#006B58]">{p.first_name[0]}{p.last_name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A2332]">{p.first_name} {p.last_name}</p>
                  <p className="text-xs text-[#4A5568]">{p.phone} · #{p.patient_id}</p>
                </div>
                {p.blood_group && <span className="text-xs font-mono font-semibold text-[#006B58]">{p.blood_group}</span>}
              </div>
            )}
          />

          <SearchPicker<Doctor>
            label="Doctor *"
            placeholder="Search by name or specialization…"
            icon={<Stethoscope className="w-3.5 h-3.5" />}
            value={selectedDoctor}
            onSelect={d => setSelectedDoctor(d)}
            onClear={() => setSelectedDoctor(null)}
            items={doctors ?? []}
            filterFn={(d, q) => `${d.first_name} ${d.last_name} ${d.specialization ?? ''}`.toLowerCase().includes(q.toLowerCase())}
            renderSelected={d => `Dr. ${d.first_name} ${d.last_name} · ${d.specialization ?? 'General'}`}
            renderItem={d => (
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-7 h-7 rounded-full bg-[#006B58]/10 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-3.5 h-3.5 text-[#006B58]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A2332]">Dr. {d.first_name} {d.last_name}</p>
                  <p className="text-xs text-[#4A5568]">{d.specialization ?? 'General'} · {d.department_name ?? ''}</p>
                </div>
                <span className="text-xs text-[#4A5568] shrink-0">{d.available_days}</span>
              </div>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#4A5568]">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="input" required />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#4A5568]">Time *</label>
              <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} className="input" required />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-[#4A5568]">Reason for Visit</label>
            <input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} className="input" placeholder="Chief complaint or reason for visit…" />
          </div>

          {formError && <p className="text-xs text-[#BA1A1A]">{formError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" type="button" onClick={() => { setShowBook(false); resetForm(); }}>Cancel</Button>
            <Button type="submit" loading={bookMutation.isPending}>Book Appointment</Button>
          </div>
        </form>
      </Modal>

      {/* Status modal */}
      <Modal open={!!showStatus} onClose={() => setShowStatus(null)} title="Update Appointment Status" size="sm">
        <div className="space-y-4">
          <Select label="Status" value={newStatus} onChange={e => setNewStatus(e.target.value as AppointmentStatus)} options={STATUS_OPTIONS} />
          <Textarea label="Notes (optional)" value={statusNotes} onChange={e => setStatusNotes(e.target.value)} rows={2} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowStatus(null)}>Cancel</Button>
            <Button loading={statusMutation.isPending} onClick={handleStatusUpdate}>Update</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}