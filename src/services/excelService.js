import ExcelJS from 'exceljs';

const COLUMNS = [
  { header: 'מספר הרשמה', key: 'serial', width: 12 },
  { header: 'שם פרטי', key: 'firstName', width: 18 },
  { header: 'שם משפחה', key: 'lastName', width: 18 },
  { header: 'שם חברה', key: 'company', width: 22 },
  { header: 'תפקיד', key: 'role', width: 20 },
  { header: 'טלפון', key: 'phone', width: 16 },
  { header: 'מייל', key: 'email', width: 28 },
  { header: 'מוצר', key: 'product', width: 22 },
  { header: 'הערות', key: 'note', width: 30 },
  { header: 'תאריך הרשמה', key: 'createdAt', width: 20 },
];

const DATE_FORMAT = 'dd/mm/yyyy hh:mm';

/**
 * בונה חוברת Excel מתוך מערך רשומות (בפורמט הלקוח) ומחזיר Buffer להורדה.
 */
export async function buildRegistrationsWorkbook(records) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'exspo';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('נרשמים', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = COLUMNS;

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.alignment = { vertical: 'middle' };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  });

  records.forEach((r, i) => {
    sheet.addRow({
      serial: r.serial ?? i + 1,
      firstName: r.firstName,
      lastName: r.lastName,
      company: r.company,
      role: r.role,
      phone: r.phone,
      email: r.email,
      product: r.product || '',
      note: r.note || '',
      createdAt: r.createdAt ? new Date(r.createdAt) : null,
    });
  });

  sheet.getColumn('createdAt').numFmt = DATE_FORMAT;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
