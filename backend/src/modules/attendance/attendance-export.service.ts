import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { AttendanceService } from './attendance.service';

const TICK = '✓';
const CROSS = '✗';

@Injectable()
export class AttendanceExportService {
  constructor(private attendance: AttendanceService) {}

  /** xlsx: col1 = student, then one column per day (✓ present / ✗ absent). */
  async buildWorkbook(hostelId: string, month?: string): Promise<Buffer> {
    const { month: label, days, students } = await this.attendance.exportMatrix(
      hostelId,
      month,
    );

    const wb = new ExcelJS.Workbook();
    wb.creator = 'HMS';
    const ws = wb.addWorksheet(`Attendance ${label}`);

    ws.getCell(1, 1).value = 'Student';
    ws.getColumn(1).width = 22;
    for (let d = 1; d <= days; d++) {
      ws.getCell(1, 1 + d).value = d;
      ws.getColumn(1 + d).width = 4;
    }
    const header = ws.getRow(1);
    header.font = { bold: true };
    header.alignment = { horizontal: 'center' };

    students.forEach((s) => {
      const cells: (string | number)[] = [s.name];
      for (let d = 1; d <= days; d++) {
        cells.push(s.absent.has(d) ? CROSS : TICK);
      }
      const row = ws.addRow(cells);
      row.alignment = { horizontal: 'center' };
      row.getCell(1).alignment = { horizontal: 'left' };
    });

    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
