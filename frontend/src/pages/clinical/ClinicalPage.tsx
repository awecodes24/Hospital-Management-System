import { useState, useRef, useEffect } from 'react';
import { FlaskConical, Search, X, User } from 'lucide-react';
import { usePatients, useMedicalRecords, usePrescriptions, usePendingLab, useUpdateLabResult } from '@/hooks';
import {
  SectionHeader, Table, Tr, Td, StatusBadge, PageLoader, EmptyState, Modal, Button, Input, Textarea, Select
} from '@/components/shared';
import { formatDate, cn } from '@/lib/utils';
import type { LabResultStatus, Patient } from '@/types';

type TabId = 'records' | 'prescriptions' | 'lab';

const LAB_STATUS_OPTIONS: { value: LabResultStatus; label: string }[] = [
  { value: 'Ordered', label: 'Ordered' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

export default function ClinicalPage() {
  const [tab, setTab] = useState<TabId>('records');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLabUpdate, setShowLabUpdate] = useState<number | null>(null);
  const [labForm, setLabForm] = useState({ result_value: '', result_date: '', status: 'Completed' as LabResultStatus, remarks: '' });
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: patients } = usePatients({ limit: 200, search: searchQuery || undefined });
  const { data: records, isLoading: loadRecords } = useMedicalRecords(selectedPatient?.patient_id ?? 0);
  const { data: prescriptions, isLoading: loadRx } = usePrescriptions(selectedPatient?.patient_id ?? 0);
  const { data: pendingLab, isLoading: loadLab } = usePendingLab();
  const updateLab = useUpdateLabResult();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selectPatient(p: Patient) {
    setSelectedPatient(p);
    setSearchQuery(`${p.first_name} ${p.last_name}`);
    setShowDropdown(false);
  }

  function clearPatient() {
    setSelectedPatient(null);
    setSearchQuery('');
  }

  async function handleLabUpdate() {
    if (!showLabUpdate) return;
    await updateLab.mutateAsync({ id: showLabUpdate, ...labForm });
    setShowLabUpdate(null);
    setLabForm({ result_value: '', result_date: '', status: 'Completed', remarks: '' });
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'records', label: 'Medical Records' },
    { id: 'prescriptions', label: 'Prescriptions' },
    { id: 'lab', label: `Pending Lab (${pendingLab?.length ?? '…'})` },
  ];

  const filteredPatients = patients?.data ?? [];

  return (
    <div>
      <SectionHeader title="Clinical" description="Medical records, prescriptions and lab results" />

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F0F4F8] rounded-xl p-1 w-fit mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn(
            'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all',
            tab === t.id ? 'bg-white text-[#006B58] shadow-md' : 'text-[#4A5568] hover:text-[#1A2332]'
          )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Patient search — only for records + prescriptions tabs */}
      {(tab === 'records' || tab === 'prescriptions') && (
        <div className="mb-5 max-w-sm" ref={searchRef}>
          <label className="block text-xs font-medium text-[#4A5568] mb-1">Search Patient</label>
          <div className="relative">
            {/* Search icon */}
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4A5568] pointer-events-none" />

            <input
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
                if (!e.target.value) setSelectedPatient(null);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Type name or phone…"
              className="input pl-9 pr-9"
            />

            {/* Clear button */}
            {searchQuery && (
              <button
                onClick={clearPatient}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5568] hover:text-[#1A2332] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Dropdown results */}
            {showDropdown && searchQuery && (
              <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white rounded-xl shadow-2xl border border-[#C0C8BB]/20 overflow-hidden max-h-64 overflow-y-auto">
                {filteredPatients.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-[#4A5568] text-center">No patients found</div>
                ) : (
                  filteredPatients.map(p => (
                    <button
                      key={p.patient_id}
                      onClick={() => selectPatient(p)}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#F0F4F8] transition-colors flex items-center gap-3 group"
                    >
                      <div className="w-7 h-7 rounded-full bg-[#006B58]/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-[#006B58]">
                          {p.first_name[0]}{p.last_name[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A2332]">{p.first_name} {p.last_name}</p>
                        <p className="text-xs text-[#4A5568]">{p.phone} · #{p.patient_id}</p>
                      </div>
                      {p.blood_group && (
                        <span className="text-xs font-mono font-semibold text-[#006B58] shrink-0">{p.blood_group}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected patient pill */}
          {selectedPatient && (
            <div className="mt-2 flex items-center gap-2 bg-[#006B58]/10 rounded-lg px-3 py-2 w-fit">
              <User className="w-3 h-3 text-[#006B58]" />
              <span className="text-xs font-medium text-[#006B58]">
                {selectedPatient.first_name} {selectedPatient.last_name} · #{selectedPatient.patient_id}
              </span>
              <button onClick={clearPatient} className="text-[#006B58]/60 hover:text-[#006B58] ml-1">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Medical Records */}
      {tab === 'records' && (
        <div className="card">
          {!selectedPatient ? (
            <EmptyState
              icon={<Search className="w-8 h-8" />}
              title="Search for a patient"
              description="Type a name or phone number above to find a patient and view their records."
            />
          ) : loadRecords ? <PageLoader /> : (
            <>
              <Table headers={['Date', 'Doctor', 'Chief Complaint', 'Diagnosis', 'Treatment', 'Vitals']}>
                {records?.map(r => (
                  <Tr key={r.record_id}>
                    <Td className="text-[#4A5568] whitespace-nowrap">{formatDate(r.visit_date)}</Td>
                    <Td>
                      <p className="font-medium text-xs">Dr. {r.doctor_name}</p>
                      <p className="text-xs text-[#4A5568]">{r.specialization}</p>
                    </Td>
                    <Td className="text-xs text-[#4A5568] max-w-[140px]">{r.chief_complaint ?? '—'}</Td>
                    <Td className="text-xs max-w-[160px]">{r.diagnosis ?? '—'}</Td>
                    <Td className="text-xs text-[#4A5568] max-w-[160px]">{r.treatment_plan ?? '—'}</Td>
                    <Td>
                      <div className="text-xs font-mono space-y-0.5 text-[#4A5568]">
                        {r.blood_pressure && <p>BP {r.blood_pressure}</p>}
                        {r.heart_rate && <p>HR {r.heart_rate}</p>}
                        {r.temperature && <p>{r.temperature}°C</p>}
                        {r.oxygen_sat && <p>SpO₂ {r.oxygen_sat}%</p>}
                        {r.weight_kg && <p>{r.weight_kg}kg</p>}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Table>
              {!records?.length && <EmptyState icon={<FlaskConical className="w-8 h-8" />} title="No records found" description="This patient has no medical records yet." />}
            </>
          )}
        </div>
      )}

      {/* Prescriptions */}
      {tab === 'prescriptions' && (
        <div className="card">
          {!selectedPatient ? (
            <EmptyState
              icon={<Search className="w-8 h-8" />}
              title="Search for a patient"
              description="Type a name or phone number above to find a patient and view their prescriptions."
            />
          ) : loadRx ? <PageLoader /> : (
            <>
              <Table headers={['Date', 'Doctor', 'Valid Till', 'Notes', 'Status']}>
                {prescriptions?.map(p => (
                  <Tr key={p.prescription_id}>
                    <Td>{formatDate(p.prescribed_date)}</Td>
                    <Td>Dr. {p.doctor_name}</Td>
                    <Td className="text-[#4A5568]">{formatDate(p.valid_till)}</Td>
                    <Td className="text-xs text-[#4A5568]">{p.notes ?? '—'}</Td>
                    <Td><StatusBadge status={p.is_valid ? 'Active' : 'Cancelled'} /></Td>
                  </Tr>
                ))}
              </Table>
              {!prescriptions?.length && <EmptyState title="No prescriptions" description="This patient has no prescriptions yet." />}
            </>
          )}
        </div>
      )}

      {/* Pending Lab */}
      {tab === 'lab' && (
        <div className="card">
          {loadLab ? <PageLoader /> : (
            <>
              <Table headers={['Test ID', 'Patient ID', 'Ordered', 'Status', 'Result', '']}>
                {pendingLab?.map(r => (
                  <Tr key={r.result_id}>
                    <Td className="font-mono text-xs">TEST-{r.test_id}</Td>
                    <Td className="font-mono text-xs">PT-{r.patient_id}</Td>
                    <Td className="text-[#4A5568]">{formatDate(r.ordered_date)}</Td>
                    <Td><StatusBadge status={r.status} /></Td>
                    <Td className="text-xs text-[#4A5568]">{r.result_value ?? '—'}</Td>
                    <Td>
                      <button
                        onClick={() => { setShowLabUpdate(r.result_id); setLabForm(f => ({ ...f, status: r.status })); }}
                        className="text-xs text-[#006B58] hover:underline"
                      >
                        Update
                      </button>
                    </Td>
                  </Tr>
                ))}
              </Table>
              {!pendingLab?.length && <EmptyState icon={<FlaskConical className="w-8 h-8" />} title="No pending lab results" />}
            </>
          )}
        </div>
      )}

      {/* Lab update modal */}
      <Modal open={!!showLabUpdate} onClose={() => setShowLabUpdate(null)} title="Update Lab Result" size="sm">
        <div className="space-y-4">
          <Select label="Status *" value={labForm.status} onChange={e => setLabForm(p => ({ ...p, status: e.target.value as LabResultStatus }))} options={LAB_STATUS_OPTIONS} />
          <Input label="Result Value" value={labForm.result_value} onChange={e => setLabForm(p => ({ ...p, result_value: e.target.value }))} />
          <Input label="Result Date" type="date" value={labForm.result_date} onChange={e => setLabForm(p => ({ ...p, result_date: e.target.value }))} />
          <Textarea label="Remarks" value={labForm.remarks} onChange={e => setLabForm(p => ({ ...p, remarks: e.target.value }))} rows={2} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowLabUpdate(null)}>Cancel</Button>
            <Button loading={updateLab.isPending} onClick={handleLabUpdate}>Update Result</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}