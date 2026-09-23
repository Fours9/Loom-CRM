import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';
import { Injectable } from '@nestjs/common';
import type { EmployeeProfilePrintModel } from '@loom/contracts-employees';
import type { QuestionnairePrintModel } from '@loom/contracts-questionnaires';

@Injectable()
export class PdfRenderer {
  private resolveFontPath(): string | null {
    const configured = process.env.PDF_FONT_PATH?.trim();
    const candidates = [
      ...(configured ? [configured] : []),
      join(process.cwd(), 'assets', 'fonts', 'DejaVuSans.ttf'),
      join(__dirname, '..', '..', '..', 'assets', 'fonts', 'DejaVuSans.ttf'),
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      'C:\\Windows\\Fonts\\arial.ttf',
      'C:\\Windows\\Fonts\\segoeui.ttf',
    ];
    for (const path of candidates) {
      if (existsSync(path)) {
        return path;
      }
    }
    return null;
  }

  private createDocument(info: {
    Title: string;
    Author: string;
  }): {
    doc: PDFKit.PDFDocument;
    done: Promise<Buffer>;
    fontPath: string | null;
  } {
    const fontPath = this.resolveFontPath();
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
      info,
    });

    if (fontPath) {
      doc.registerFont('Body', fontPath);
      doc.font('Body');
    }

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    return { doc, done, fontPath };
  }

  private drawPageNumbers(doc: PDFKit.PDFDocument): void {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const bottom = doc.page.height - 30;
      const left = doc.page.margins.left;
      const width =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc
        .fontSize(8)
        .fillColor('#666')
        .text(`${i + 1} / ${range.count}`, left, bottom, {
          width,
          align: 'center',
        });
    }
  }

  async renderEmployeeProfile(
    model: EmployeeProfilePrintModel,
  ): Promise<Buffer> {
    const { doc, done } = this.createDocument({
      Title: `Анкета ${model.employeeNumber}`,
      Author: model.generatedByLabel,
    });

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const top = doc.page.margins.top;
    const pageWidth = right - left;
    const metaWidth = 230;
    const metaX = right - metaWidth;

    doc.fontSize(8).fillColor('#555');
    doc.text(`Сформовано: ${model.generatedAtLabel}`, metaX, top, {
      width: metaWidth,
      align: 'right',
    });
    doc.text(`Користувач: ${model.generatedByLabel}`, metaX, doc.y + 2, {
      width: metaWidth,
      align: 'right',
    });
    doc.text(`Версія: ${model.templateVersion}`, metaX, doc.y + 2, {
      width: metaWidth,
      align: 'right',
    });
    const headerBottom = doc.y;
    doc.fillColor('#000');
    doc.x = left;
    doc.y = top;

    doc.fontSize(18).text('Анкета працівника', left, top, {
      width: pageWidth - metaWidth - 12,
      align: 'left',
    });
    doc.y = Math.max(doc.y, headerBottom) + 8;
    doc.x = left;
    doc.fontSize(14).text(model.fullName);
    doc.fontSize(10).fillColor('#444').text(`Номер: ${model.employeeNumber}`);
    doc.fillColor('#000');
    doc.moveDown();

    this.section(doc, 'Посада', pageWidth);
    this.line(doc, 'Відділ', model.departmentName);
    this.line(doc, 'Посада', model.positionName);

    this.section(doc, 'Робочі контакти', pageWidth);
    this.line(doc, 'Телефон', model.phoneNumber);
    this.line(doc, 'Telegram', model.telegram);
    this.line(doc, 'Email', model.email);

    this.section(doc, 'Робочий графік', pageWidth);
    if (!model.schedule?.length) {
      doc.fontSize(10).text('Графік не зазначено');
    } else {
      const colDay = 130;
      const colWork = 180;
      const colBreak = pageWidth - colDay - colWork;
      const startX = doc.page.margins.left;
      let y = doc.y;
      doc.fontSize(9).fillColor('#333');
      doc.text('День', startX, y, { width: colDay, continued: false });
      doc.text('Робочий час', startX + colDay, y, { width: colWork });
      doc.text('Перерва', startX + colDay + colWork, y, { width: colBreak });
      y = doc.y + 4;
      doc
        .moveTo(startX, y)
        .lineTo(startX + pageWidth, y)
        .strokeColor('#ccc')
        .stroke();
      doc.fillColor('#000');
      y += 6;
      for (const day of model.schedule) {
        this.ensureSpace(doc, 36);
        y = Math.max(y, doc.y);
        const rowTop = y;
        doc.fontSize(9);
        doc.text(day.weekdayLabel, startX, rowTop, { width: colDay });
        doc.text(day.workTime || 'Вихідний', startX + colDay, rowTop, {
          width: colWork,
        });
        doc.text(day.breakTime || '—', startX + colDay + colWork, rowTop, {
          width: colBreak,
        });
        y = Math.max(doc.y, rowTop) + 8;
        doc.y = y;
      }
      doc.x = doc.page.margins.left;
      doc.y = y;
    }

    this.ensureSpace(doc, 60);
    doc.x = doc.page.margins.left;
    this.section(doc, 'Коментар', pageWidth);
    doc.x = doc.page.margins.left;
    doc.fontSize(10).text(model.comment?.trim() ? model.comment : '—', {
      width: pageWidth,
      align: 'left',
    });

    this.drawPageNumbers(doc);
    doc.end();
    return done;
  }

  async renderQuestionnaire(model: QuestionnairePrintModel): Promise<Buffer> {
    const { doc, done } = this.createDocument({
      Title: model.meta.title,
      Author: model.meta.generatedByLabel,
    });

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const top = doc.page.margins.top;
    const pageWidth = right - left;
    const metaWidth = 230;
    const metaX = right - metaWidth;

    doc.fontSize(8).fillColor('#555');
    doc.text(`Сформовано: ${model.meta.generatedAtLabel}`, metaX, top, {
      width: metaWidth,
      align: 'right',
    });
    doc.text(`Користувач: ${model.meta.generatedByLabel}`, metaX, doc.y + 2, {
      width: metaWidth,
      align: 'right',
    });
    doc.text(
      `Схема v${model.meta.schemaVersion} · layout ${model.meta.printLayoutVersion}`,
      metaX,
      doc.y + 2,
      { width: metaWidth, align: 'right' },
    );
    const headerBottom = doc.y;

    doc.fillColor('#000');
    doc.x = left;
    doc.y = top;
    doc.fontSize(16).text(model.meta.title, left, top, {
      width: pageWidth - metaWidth - 12,
    });
    doc.fontSize(9).fillColor('#a00').text('Конфіденційно', {
      width: pageWidth - metaWidth - 12,
    });
    doc.fillColor('#444').fontSize(9);
    doc.text(
      `${model.meta.templateTypeLabelUa} · ${model.meta.templateCode}`,
      { width: pageWidth - metaWidth - 12 },
    );
    if (model.meta.assignmentCode) {
      doc.text(`Код: ${model.meta.assignmentCode}`, {
        width: pageWidth - metaWidth - 12,
      });
    }
    if (model.meta.employeeDisplayName) {
      doc.text(model.meta.employeeDisplayName, {
        width: pageWidth - metaWidth - 12,
      });
    }
    doc.y = Math.max(doc.y, headerBottom) + 10;
    doc.x = left;
    doc.fillColor('#000');

    for (const step of model.steps) {
      this.section(doc, step.label, pageWidth);
      for (const field of step.fields) {
        if (field.kind === 'scalar') {
          this.printScalarRow(doc, field.label, field.display, pageWidth);
        } else {
          this.ensureSpace(doc, 28);
          doc.fontSize(10).fillColor('#000').text(field.label);
          let rowIndex = 0;
          for (const row of field.rows) {
            rowIndex += 1;
            this.ensureSpace(doc, 20 + row.cells.length * 16);
            doc
              .fontSize(9)
              .fillColor('#555')
              .text(`Запис ${rowIndex}`, { indent: 8 });
            for (const cell of row.cells) {
              this.printScalarRow(
                doc,
                cell.label,
                cell.display,
                pageWidth,
                16,
              );
            }
          }
          doc.fillColor('#000');
        }
      }
    }

    this.drawPageNumbers(doc);
    doc.end();
    return done;
  }

  private printScalarRow(
    doc: PDFKit.PDFDocument,
    label: string,
    display: string | null,
    pageWidth: number,
    indent = 0,
  ): void {
    this.ensureSpace(doc, 22);
    const left = doc.page.margins.left + indent;
    const labelWidth = Math.min(180, pageWidth * 0.4);
    const valueX = left + labelWidth + 8;
    const valueWidth = pageWidth - labelWidth - 8 - indent;
    const y = doc.y;
    doc.fontSize(9).fillColor('#222').text(`${label}:`, left, y, {
      width: labelWidth,
    });
    const afterLabelY = doc.y;
    if (display == null || display === '') {
      const lineY = y + 11;
      doc
        .moveTo(valueX, lineY)
        .lineTo(valueX + valueWidth, lineY)
        .strokeColor('#999')
        .lineWidth(0.6)
        .stroke();
      doc.strokeColor('#000').lineWidth(1);
      doc.y = Math.max(afterLabelY, lineY + 6);
    } else {
      doc.fontSize(9).fillColor('#000').text(display, valueX, y, {
        width: valueWidth,
      });
      doc.y = Math.max(afterLabelY, doc.y) + 4;
    }
    doc.x = doc.page.margins.left;
  }

  private section(
    doc: PDFKit.PDFDocument,
    title: string,
    pageWidth: number,
  ): void {
    this.ensureSpace(doc, 48);
    const left = doc.page.margins.left;
    doc.x = left;
    doc.moveDown(0.55);
    const lineY = doc.y;
    doc
      .moveTo(left, lineY)
      .lineTo(left + pageWidth, lineY)
      .lineWidth(0.9)
      .strokeColor('#8a93a0')
      .stroke();
    doc.strokeColor('#000').lineWidth(1);
    doc.y = lineY + 12;
    doc.fontSize(12).fillColor('#000').text(title);
    doc.moveDown(0.85);
  }

  private line(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string | null | undefined,
  ): void {
    if (!value) {
      return;
    }
    this.ensureSpace(doc, 16);
    doc.fontSize(10).text(`${label}: ${value}`);
  }

  private ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
    const bottomLimit = doc.page.height - doc.page.margins.bottom - 36;
    if (doc.y + needed > bottomLimit) {
      doc.addPage();
    }
  }
}
