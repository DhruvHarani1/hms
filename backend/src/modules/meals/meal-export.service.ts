import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { MealsService } from './meals.service';

const TICK = '✓';
const CROSS = '✗';

@Injectable()
export class MealExportService {
  constructor(private meals: MealsService) {}

  /** Build an .xlsx buffer: rows = students, columns = day → [B,L,D]. */
  async buildWorkbook(hostelId: string, month?: string): Promise<Buffer> {
    const { month: label, days, students } = await this.meals.exportMatrix(
      hostelId,
      month,
    );

    const wb = new ExcelJS.Workbook();
    wb.creator = 'HMS';
    const ws = wb.addWorksheet(`Meals ${label}`);

    // Two header rows: row1 = day numbers (merged over 3), row2 = B/L/D.
    // Column 1 = Student name (merged across both header rows).
    ws.getCell(1, 1).value = 'Student';
    ws.mergeCells(1, 1, 2, 1);
    ws.getColumn(1).width = 22;

    for (let d = 1; d <= days; d++) {
      const firstCol = 2 + (d - 1) * 3; // 3 sub-cols per day
      ws.getCell(1, firstCol).value = d;
      ws.mergeCells(1, firstCol, 1, firstCol + 2);
      ws.getCell(2, firstCol).value = 'B';
      ws.getCell(2, firstCol + 1).value = 'L';
      ws.getCell(2, firstCol + 2).value = 'D';
      for (let c = firstCol; c <= firstCol + 2; c++) ws.getColumn(c).width = 3.5;
    }

    // Style header rows.
    [1, 2].forEach((r) => {
      const row = ws.getRow(r);
      row.font = { bold: true };
      row.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Data rows.
    students.forEach((s) => {
      const cells: (string | number)[] = [s.name];
      for (let d = 1; d <= days; d++) {
        const day = s.perDay[d];
        const lunch = !!day?.lunch;
        const dinner = !!day?.dinner;
        const breakfast = lunch || dinner; // derived
        cells.push(breakfast ? TICK : CROSS);
        cells.push(lunch ? TICK : CROSS);
        cells.push(dinner ? TICK : CROSS);
      }
      const row = ws.addRow(cells);
      row.alignment = { horizontal: 'center' };
      row.getCell(1).alignment = { horizontal: 'left' };
    });

    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 2 }];

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
