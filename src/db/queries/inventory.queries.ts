import { query, queryOne } from '../pool';
import { MedicineRow, MedicineStockRow } from '../../types/db.types';

export async function getMedicines(limit: number, offset: number) {
  return query<MedicineRow & { quantity: number; stock_status: string }>(
    `SELECT m.*,
            s.quantity,
            CASE
              WHEN s.quantity = 0                    THEN 'OUT OF STOCK'
              WHEN s.quantity <= s.reorder_level     THEN 'LOW STOCK'
              WHEN DATEDIFF(s.expiry_date, CURDATE()) < 90 THEN 'EXPIRING SOON'
              ELSE 'OK'
            END AS stock_status
     FROM medicines m
     JOIN medicine_stock s ON m.medicine_id = s.medicine_id
     WHERE m.is_active = TRUE
     ORDER BY m.name
     LIMIT ${Math.abs(Math.trunc(limit))} OFFSET ${Math.abs(Math.trunc(offset))}`,
    [],
  );
}

export async function countMedicines(): Promise<number> {
  const rows = await query<{ total: number }>(
    'SELECT COUNT(*) AS total FROM medicines WHERE is_active = TRUE',
  );
  return rows[0].total;
}

export async function getMedicineById(medicineId: number) {
  return queryOne<MedicineRow & MedicineStockRow>(
    `SELECT m.*, s.quantity, s.reorder_level, s.expiry_date, s.last_updated
     FROM medicines m
     JOIN medicine_stock s ON m.medicine_id = s.medicine_id
     WHERE m.medicine_id = ?`,
    [medicineId],
  );
}

export async function getLowStock() {
  return query<{
    medicine_id:   number;
    medicine_name: string;
    category:      string | null;
    current_stock: number;
    reorder_level: number;
    expiry_date:   Date | null;
    stock_status:  string;
  }>('SELECT * FROM vw_low_stock', []);
}

export async function updateStock(
  medicineId: number,
  quantity: number,
  expiryDate?: string,
): Promise<void> {
  await query(
    `UPDATE medicine_stock
     SET quantity    = ?,
         expiry_date = COALESCE(?, expiry_date),
         last_updated = NOW()
     WHERE medicine_id = ?`,
    [quantity, expiryDate ?? null, medicineId],
  );
}

export async function getStockReport() {
  return query<{
    category:        string | null;
    medicine_count:  number;
    total_units:     number;
    stock_value_npr: number;
  }>(
    `SELECT
       m.category,
       COUNT(*)                          AS medicine_count,
       SUM(s.quantity)                   AS total_units,
       SUM(s.quantity * m.unit_price)    AS stock_value_npr
     FROM medicines m
     JOIN medicine_stock s ON m.medicine_id = s.medicine_id
     WHERE m.is_active = TRUE
     GROUP BY m.category
     ORDER BY stock_value_npr DESC`,
    [],
  );
}