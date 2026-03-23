import { useState } from 'react';
import { Package, AlertTriangle, BarChart2 } from 'lucide-react';
import { useMedicines, useLowStock, useStockReport, useUpdateStock } from '@/hooks';
import {
  SectionHeader, Table, Tr, Td, StatusBadge, Pagination,
  PageLoader, EmptyState, Modal, Button, Input, StatCard
} from '@/components/shared';
import { formatDate, formatCurrency, cn } from '@/lib/utils';

type TabId = 'medicines' | 'low-stock' | 'report';

export default function InventoryPage() {
  const [tab, setTab] = useState<TabId>('medicines');
  const [page, setPage] = useState(1);
  const [showUpdate, setShowUpdate] = useState<number | null>(null);
  const [stockForm, setStockForm] = useState({ quantity: '', expiry_date: '' });

  const { data: medicines, isLoading: loadMed } = useMedicines({ page, limit: 20 });
  const { data: lowStock, isLoading: loadLow } = useLowStock();
  const { data: stockReport, isLoading: loadReport } = useStockReport();
  const updateMutation = useUpdateStock();

  const totalValue = stockReport?.reduce((s, r) => s + Number(r.stock_value_npr), 0) ?? 0;
  const totalMeds = medicines?.meta?.total ?? 0;
  const lowCount = lowStock?.length ?? 0;

  async function handleUpdateStock(e: React.FormEvent) {
    e.preventDefault();
    if (!showUpdate) return;
    await updateMutation.mutateAsync({
      id: showUpdate,
      quantity: parseInt(stockForm.quantity),
      expiry_date: stockForm.expiry_date || undefined,
    });
    setShowUpdate(null);
    setStockForm({ quantity: '', expiry_date: '' });
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'medicines', label: `Medicines (${totalMeds})` },
    { id: 'low-stock', label: `Low Stock (${lowCount})` },
    { id: 'report', label: 'Stock Report' },
  ];

  return (
    <div>
      <SectionHeader title="Inventory" description="Medicine stock management and pharmacy operations" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Medicines" value={totalMeds} icon={<Package className="w-4 h-4" />} />
        <StatCard label="Low / Out of Stock" value={lowCount} sub="requiring attention" icon={<AlertTriangle className="w-4 h-4" />} />
        <StatCard label="Total Stock Value" value={formatCurrency(totalValue)} icon={<BarChart2 className="w-4 h-4" />} />
      </div>

      {/* Low stock alert banner */}
      {lowCount > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200/60 rounded-xl px-4 py-3 mb-6">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{lowCount} items</span> need restocking. Review the Low Stock tab.
          </p>
          <button
            onClick={() => setTab('low-stock')}
            className="ml-auto text-xs text-amber-700 font-medium hover:underline"
          >
            View →
          </button>
        </div>
      )}

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

      {/* All medicines */}
      {tab === 'medicines' && (
        <div className="card">
          {loadMed ? <PageLoader /> : (
            <>
              <Table headers={['Medicine', 'Category', 'Unit Price', 'Stock', 'Expiry', 'Status', '']}>
                {medicines?.data.map(m => (
                  <Tr key={m.medicine_id}>
                    <Td>
                      <p className="font-medium">{m.name}</p>
                      {m.generic_name && <p className="text-xs text-[#4A5568] italic">{m.generic_name}</p>}
                      {m.manufacturer && <p className="text-xs text-[#4A5568]">{m.manufacturer}</p>}
                    </Td>
                    <Td className="text-[#4A5568] text-xs">{m.category ?? '—'}</Td>
                    <Td className="text-xs">{formatCurrency(Number(m.unit_price))}</Td>
                    <Td>
                      <span className={cn(
                        'font-mono text-sm font-semibold',
                        Number(m.quantity) === 0 ? 'text-[#BA1A1A]' :
                        m.stock_status === 'LOW STOCK' ? 'text-amber-600' : 'text-[#006B58]'
                      )}>
                        {Number(m.quantity)}
                      </span>
                      <span className="text-xs text-[#4A5568] ml-1">{m.unit}</span>
                    </Td>
                    <Td className="text-xs text-[#4A5568]">{formatDate(m.expiry_date)}</Td>
                    <Td><StatusBadge status={m.stock_status} /></Td>
                    <Td>
                      <button
                        onClick={() => {
                          setShowUpdate(m.medicine_id);
                          setStockForm({ quantity: String(Number(m.quantity)), expiry_date: m.expiry_date ? m.expiry_date.split('T')[0] : '' });
                        }}
                        className="text-xs text-[#006B58] hover:underline whitespace-nowrap"
                      >
                        Update Stock
                      </button>
                    </Td>
                  </Tr>
                ))}
              </Table>
              {medicines?.data.length === 0 && <EmptyState icon={<Package className="w-8 h-8" />} title="No medicines found" />}
              {medicines?.meta && <Pagination {...medicines.meta} onPage={setPage} />}
            </>
          )}
        </div>
      )}

      {/* Low stock */}
      {tab === 'low-stock' && (
        <div className="card">
          {loadLow ? <PageLoader /> : (
            <>
              <Table headers={['Medicine', 'Category', 'Current Stock', 'Reorder Level', 'Expiry', 'Status', '']}>
                {lowStock?.map(m => {
                  // vw_low_stock returns: medicine_name, current_stock (not name/quantity)
                  const name  = (m as any).medicine_name ?? m.name ?? '—';
                  const stock = Number((m as any).current_stock ?? m.quantity ?? 0);
                  return (
                  <Tr key={m.medicine_id}>
                    <Td>
                      <p className="font-medium">{name}</p>
                    </Td>
                    <Td className="text-xs text-[#4A5568]">{m.category ?? '—'}</Td>
                    <Td>
                      <span className={cn('font-mono text-sm font-semibold', stock === 0 ? 'text-[#BA1A1A]' : 'text-amber-600')}>
                        {stock}
                      </span>
                    </Td>
                    <Td className="font-mono text-xs text-[#4A5568]">{Number(m.reorder_level) || '—'}</Td>
                    <Td className="text-xs text-[#4A5568]">{formatDate(m.expiry_date)}</Td>
                    <Td><StatusBadge status={m.stock_status} /></Td>
                    <Td>
                      <button
                        onClick={() => {
                          setShowUpdate(m.medicine_id);
                          setStockForm({ quantity: String(stock), expiry_date: '' });
                        }}
                        className="text-xs text-[#006B58] hover:underline"
                      >
                        Restock
                      </button>
                    </Td>
                  </Tr>
                  );
                })}
              </Table>
              {!lowStock?.length && (
                <EmptyState
                  icon={<Package className="w-8 h-8" />}
                  title="All stock levels are healthy"
                  description="No medicines require restocking at this time."
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Stock report */}
      {tab === 'report' && (
        <div className="card">
          {loadReport ? <PageLoader /> : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {stockReport?.map(r => (
                  <div key={r.category ?? 'uncategorized'} className="card bg-[#F0F4F8]">
                    <p className="text-xs text-[#4A5568]">{r.category ?? 'Uncategorized'}</p>
                    <p className="text-xl font-sans font-semibold text-[#1A2332] mt-1">{Number(r.medicine_count)}</p>
                    <p className="text-xs text-[#4A5568] mt-0.5">{Number(r.total_units).toLocaleString()} units</p>
                    <p className="text-xs font-medium text-[#006B58] mt-1">{formatCurrency(Number(r.stock_value_npr))}</p>
                  </div>
                ))}
              </div>
              <Table headers={['Category', 'Medicines', 'Total Units', 'Stock Value (NPR)']}>
                {stockReport?.map(r => (
                  <Tr key={r.category ?? 'none'}>
                    <Td><p className="font-medium">{r.category ?? 'Uncategorized'}</p></Td>
                    <Td>{Number(r.medicine_count)}</Td>
                    <Td className="font-mono">{Number(r.total_units).toLocaleString()}</Td>
                    <Td className="font-medium">{formatCurrency(Number(r.stock_value_npr))}</Td>
                  </Tr>
                ))}
                {stockReport && stockReport.length > 0 && (
                  <Tr className="border-t border-[#C0C8BB]/20 font-semibold">
                    <Td>Total</Td>
                    <Td>{stockReport.reduce((s, r) => s + Number(r.medicine_count), 0)}</Td>
                    <Td className="font-mono">{stockReport.reduce((s, r) => s + Number(r.total_units), 0).toLocaleString()}</Td>
                    <Td className="text-[#006B58]">{formatCurrency(totalValue)}</Td>
                  </Tr>
                )}
              </Table>
              {!stockReport?.length && <EmptyState title="No stock data" />}
            </>
          )}
        </div>
      )}

      {/* Update stock modal */}
      <Modal open={!!showUpdate} onClose={() => setShowUpdate(null)} title="Update Stock" size="sm">
        <form onSubmit={handleUpdateStock} className="space-y-4">
          <Input
            label="New Quantity *"
            type="number"
            min="0"
            value={stockForm.quantity}
            onChange={e => setStockForm(p => ({ ...p, quantity: e.target.value }))}
            required
          />
          <Input
            label="Expiry Date (optional)"
            type="date"
            value={stockForm.expiry_date}
            onChange={e => setStockForm(p => ({ ...p, expiry_date: e.target.value }))}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowUpdate(null)}>Cancel</Button>
            <Button type="submit" loading={updateMutation.isPending}>Update Stock</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}