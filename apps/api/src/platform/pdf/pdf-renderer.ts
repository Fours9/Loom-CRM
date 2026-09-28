import type {
  QuestionnairePrintControl,
  QuestionnairePrintField,
  QuestionnairePrintModel,
  QuestionnairePrintSkillRow,
} from '@loom/contracts-questionnaires';
import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';
import { Injectable } from '@nestjs/common';
import type { EmployeeProfilePrintModel } from '@loom/contracts-employees';

type PdfDoc = PDFKit.PDFDocument;

const CONTROL_WEIGHT: Record<QuestionnairePrintControl['kind'], number> = {
  checkbox_item: 0.6,
  text_line: 1.5,
  choice_list: 1.6,
  text_box: 2.5,
};

/** Handwriting line pitch inside ruled boxes. */
const RULED_LINE_HEIGHT = 16;
/** Single-line write zone under a field label (paper form). */
const TEXT_LINE_WRITE_HEIGHT = 22;
const LABEL_TO_WRITE_GAP = 4;
const FIELD_BOTTOM_GAP = 10;
const CHECKBOX_SIZE = 9;
const CELL_PAD = 4;
/** Treat page as "fresh" if cursor is still near the top margin. */
const FRESH_PAGE_Y_SLACK = 28;

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
    doc: PdfDoc;
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

  private drawPageNumbers(doc: PdfDoc): void {
    const range = doc.bufferedPageRange();
    const originalCount = range.count;
    for (let i = 0; i < originalCount; i++) {
      doc.switchToPage(range.start + i);
      const left = doc.page.margins.left;
      const width =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      // Stay inside the bottom margin band; never below the printable edge in a
      // way that makes pdfkit append a blank overflow page.
      const y = doc.page.height - 36;
      doc.save();
      doc.fontSize(8).fillColor('#666');
      doc.text(`${i + 1} / ${originalCount}`, left, y, {
        width,
        align: 'center',
        lineBreak: false,
        height: 10,
      });
      doc.restore();
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

    for (let stepIndex = 0; stepIndex < model.steps.length; stepIndex++) {
      const step = model.steps[stepIndex]!;
      // Major blocks (e.g. «Професійний досвід») start on a new page for easy
      // physical separation — skip if already on a fresh page (avoids blanks).
      this.beginMajorSection(doc, stepIndex === 0);
      this.section(doc, step.label, pageWidth);
      for (const field of step.fields) {
        this.drawPrintField(doc, field, pageWidth);
      }
    }

    this.drawPageNumbers(doc);
    doc.end();
    return done;
  }

  private drawPrintField(
    doc: PdfDoc,
    field: QuestionnairePrintField,
    pageWidth: number,
  ): void {
    if (
      field.kind === 'text_line' ||
      field.kind === 'text_box' ||
      field.kind === 'choice_list' ||
      field.kind === 'checkbox_item'
    ) {
      const h = this.measurePrintControlHeight(doc, field, pageWidth);
      this.ensureSpace(doc, h);
      this.drawPrintControl(doc, field, doc.page.margins.left, pageWidth);
      return;
    }

    if (field.kind === 'repeating_table') {
      this.ensureSpace(doc, 24);
      doc.fontSize(10).fillColor('#000').text(field.label);
      doc.moveDown(0.3);
      const widths = this.columnWidthsForControls(
        field.rows[0]?.cells ?? [],
        pageWidth,
        field.columns,
      );
      // Header
      this.ensureSpace(doc, 18);
      let x = doc.page.margins.left;
      const headerY = doc.y;
      doc.fontSize(8).fillColor('#555');
      for (let i = 0; i < field.columns.length; i++) {
        doc.text(field.columns[i]?.label ?? '', x, headerY, {
          width: widths[i],
        });
        x += widths[i];
      }
      doc.y = Math.max(doc.y, headerY + 12);
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.margins.left + pageWidth, doc.y)
        .strokeColor('#ccc')
        .lineWidth(0.5)
        .stroke();
      doc.strokeColor('#000').lineWidth(1);
      doc.y += 4;

      for (const row of field.rows) {
        const rowH = this.measureTableRowHeight(doc, row.cells, widths);
        this.ensureSpace(doc, rowH);
        this.drawTableRow(doc, row.cells, widths);
      }
      doc.fillColor('#000');
      doc.x = doc.page.margins.left;
      doc.moveDown(0.4);
      return;
    }

    if (field.kind === 'contacts_form') {
      this.ensureSpace(doc, 24);
      doc.fontSize(10).fillColor('#000').text(field.label);
      doc.moveDown(0.25);
      doc.fontSize(9).fillColor('#555').text('Робочі контакти');
      doc.fillColor('#000');
      for (const c of field.work) {
        const h = this.measurePrintControlHeight(doc, c, pageWidth - 8);
        this.ensureSpace(doc, h);
        this.drawPrintControl(doc, c, doc.page.margins.left + 8, pageWidth - 8);
      }
      doc.fontSize(9).fillColor('#555').text('Особисті контакти');
      doc.fillColor('#000');
      for (const p of field.personal) {
        const h = this.measurePrintControlHeight(doc, p.control, pageWidth - 8);
        this.ensureSpace(doc, h);
        this.drawPrintControl(
          doc,
          p.control,
          doc.page.margins.left + 8,
          pageWidth - 8,
        );
      }
      doc.fontSize(9).fillColor('#555').text('Екстрені контакти');
      doc.fillColor('#000');
      for (let i = 0; i < field.emergency.length; i++) {
        this.ensureSpace(doc, 20);
        doc
          .fontSize(8)
          .fillColor('#555')
          .text(`Контакт ${i + 1}`, { indent: 8 });
        doc.fillColor('#000');
        for (const c of field.emergency[i].controls) {
          const h = this.measurePrintControlHeight(doc, c, pageWidth - 8);
          this.ensureSpace(doc, h);
          this.drawPrintControl(
            doc,
            c,
            doc.page.margins.left + 8,
            pageWidth - 8,
          );
        }
      }
      return;
    }

    if (field.kind === 'skills_matrix') {
      this.ensureSpace(doc, 24);
      doc.fontSize(10).fillColor('#000').text(field.label);
      doc.moveDown(0.25);
      const labelW = pageWidth * 0.35;
      const ratingW = pageWidth * 0.35;
      const commentW = pageWidth - labelW - ratingW;
      this.ensureSpace(doc, 16);
      const hy = doc.y;
      const lx = doc.page.margins.left;
      doc.fontSize(8).fillColor('#555');
      doc.text('Навичка', lx, hy, { width: labelW });
      doc.text('Оцінка', lx + labelW, hy, { width: ratingW });
      doc.text('Коментар', lx + labelW + ratingW, hy, { width: commentW });
      doc.y = hy + 12;
      doc.fillColor('#000');

      for (const row of field.rows) {
        const h = this.measureSkillRowHeight(doc, row, labelW, ratingW, commentW);
        this.ensureSpace(doc, h);
        this.drawSkillRow(doc, row, labelW, ratingW, commentW);
      }
    }
  }

  private controlWeight(
    control: QuestionnairePrintControl,
    columnKey?: string,
  ): number {
    if (control.kind === 'checkbox_item') return CONTROL_WEIGHT.checkbox_item;
    if (control.kind === 'text_box') return CONTROL_WEIGHT.text_box;
    if (control.kind === 'choice_list') return 2.4;
    if (
      columnKey &&
      (columnKey.toLowerCase().includes('date') ||
        columnKey.toLowerCase().includes('at') ||
        columnKey === 'from' ||
        columnKey === 'to' ||
        columnKey === 'dueDate' ||
        columnKey === 'targetDate' ||
        columnKey === 'completedAt' ||
        columnKey === 'issuedAt' ||
        columnKey === 'returnedAt' ||
        columnKey === 'grantedAt' ||
        columnKey === 'birth_date')
    ) {
      return 0.9;
    }
    if (
      columnKey &&
      (columnKey === 'name' ||
        columnKey === 'item' ||
        columnKey === 'title' ||
        columnKey === 'system')
    ) {
      return 1.2;
    }
    return CONTROL_WEIGHT.text_line;
  }

  private columnWidthsForControls(
    sampleCells: QuestionnairePrintControl[],
    pageWidth: number,
    columns: Array<{ key: string; label: string }>,
  ): number[] {
    const n = Math.max(columns.length, sampleCells.length, 1);
    const weights: number[] = [];
    for (let i = 0; i < n; i++) {
      const cell = sampleCells[i];
      const col = columns[i];
      weights.push(
        cell
          ? this.controlWeight(cell, col?.key)
          : 1.5,
      );
    }
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    return weights.map((w) => (w / sum) * pageWidth);
  }

  measurePrintControlHeight(
    doc: PdfDoc,
    control: QuestionnairePrintControl,
    width: number,
  ): number {
    if (control.kind === 'checkbox_item') {
      return CHECKBOX_SIZE + FIELD_BOTTOM_GAP;
    }
    if (control.kind === 'text_line') {
      const labelH = 12;
      const valueExtra = control.value
        ? Math.max(
            0,
            doc.heightOfString(control.value, { width: width - 8 }) -
              TEXT_LINE_WRITE_HEIGHT +
              4,
          )
        : 0;
      return (
        labelH +
        LABEL_TO_WRITE_GAP +
        TEXT_LINE_WRITE_HEIGHT +
        valueExtra +
        FIELD_BOTTOM_GAP
      );
    }
    if (control.kind === 'text_box') {
      return (
        12 +
        LABEL_TO_WRITE_GAP +
        control.lines * RULED_LINE_HEIGHT +
        4 +
        FIELD_BOTTOM_GAP
      );
    }
    if (control.kind === 'choice_list') {
      if (control.layout === 'horizontal') {
        return (
          12 +
          LABEL_TO_WRITE_GAP +
          11 +
          CHECKBOX_SIZE +
          FIELD_BOTTOM_GAP
        );
      }
      return (
        12 +
        LABEL_TO_WRITE_GAP +
        control.options.length * (CHECKBOX_SIZE + 6) +
        FIELD_BOTTOM_GAP
      );
    }
    return TEXT_LINE_WRITE_HEIGHT + FIELD_BOTTOM_GAP;
  }

  measureTableRowHeight(
    doc: PdfDoc,
    cells: QuestionnairePrintControl[],
    widths: number[],
  ): number {
    let max = 20;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (!cell) continue;
      const w = Math.max(24, (widths[i] ?? 40) - CELL_PAD * 2);
      if (cell.kind === 'choice_list') {
        // Horizontal: label above checkbox in one row.
        max = Math.max(max, 12 + CHECKBOX_SIZE + 8);
        continue;
      }
      max = Math.max(max, this.measurePrintControlHeight(doc, cell, w));
    }
    return max + 4;
  }

  private measureSkillRowHeight(
    doc: PdfDoc,
    row: QuestionnairePrintSkillRow,
    labelW: number,
    ratingW: number,
    commentW: number,
  ): number {
    let h = TEXT_LINE_WRITE_HEIGHT;
    if (row.rating.kind === 'choice_scale') {
      h = Math.max(h, row.rating.options.length * (CHECKBOX_SIZE + 4));
    } else if (row.rating.kind === 'number') {
      h = Math.max(h, TEXT_LINE_WRITE_HEIGHT);
    } else {
      h = Math.max(h, TEXT_LINE_WRITE_HEIGHT);
    }
    if (row.comment) {
      h = Math.max(
        h,
        doc.heightOfString(row.comment, { width: commentW - 4 }) + 8,
      );
    } else {
      h = Math.max(h, TEXT_LINE_WRITE_HEIGHT);
    }
    void labelW;
    void ratingW;
    return h;
  }

  private drawTableRow(
    doc: PdfDoc,
    cells: QuestionnairePrintControl[],
    widths: number[],
  ): void {
    const startY = doc.y;
    const left = doc.page.margins.left;
    let x = left;
    let maxY = startY;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const w = widths[i] ?? 40;
      if (cell) {
        doc.y = startY;
        this.drawPrintControlCompact(doc, cell, x + CELL_PAD, w - CELL_PAD * 2);
        maxY = Math.max(maxY, doc.y);
      }
      x += w;
    }
    doc.y = maxY + 4;
    doc.x = left;
  }

  private drawSkillRow(
    doc: PdfDoc,
    row: QuestionnairePrintSkillRow,
    labelW: number,
    ratingW: number,
    commentW: number,
  ): void {
    const left = doc.page.margins.left;
    const y0 = doc.y;
    const label =
      row.label ??
      (row.identity.kind === 'blank' ? '' : null);
    doc.fontSize(9).fillColor('#000');
    if (label) {
      doc.text(label, left, y0, { width: labelW - 4 });
    } else {
      this.drawUnderline(doc, left, y0 + 10, labelW - 8);
    }
    let afterLabel = doc.y;

    doc.y = y0;
    this.drawSkillRating(doc, row, left + labelW, ratingW - 4);
    const afterRating = doc.y;

    doc.y = y0;
    if (row.comment) {
      doc
        .fontSize(8)
        .fillColor('#000')
        .text(row.comment, left + labelW + ratingW, y0, {
          width: commentW - 4,
        });
    } else {
      this.drawUnderline(
        doc,
        left + labelW + ratingW,
        y0 + 10,
        commentW - 8,
      );
    }
    doc.y = Math.max(afterLabel, afterRating, doc.y) + 6;
    doc.x = left;
  }

  private drawSkillRating(
    doc: PdfDoc,
    row: QuestionnairePrintSkillRow,
    x: number,
    width: number,
  ): void {
    const rating = row.rating;
    if (rating.kind === 'freehand') {
      if (rating.value) {
        doc.fontSize(9).text(rating.value, x, doc.y, { width });
      } else {
        this.drawUnderline(doc, x, doc.y + 10, width - 4);
        doc.y += 14;
      }
      return;
    }
    if (rating.kind === 'number') {
      const text =
        rating.value == null
          ? null
          : rating.unit === '%'
            ? `${rating.value}%`
            : String(rating.value);
      if (text) {
        doc.fontSize(9).text(text, x, doc.y, { width });
      } else {
        this.drawUnderline(doc, x, doc.y + 10, width - 4);
        doc.y += 14;
      }
      return;
    }
    // choice_scale
    let y = doc.y;
    for (const opt of rating.options) {
      this.drawCheckbox(doc, x, y, opt.checked);
      doc
        .fontSize(8)
        .fillColor('#000')
        .text(opt.label, x + CHECKBOX_SIZE + 4, y, {
          width: width - CHECKBOX_SIZE - 6,
        });
      y += CHECKBOX_SIZE + 4;
    }
    doc.y = y;
  }

  /** Full-width stacked control (top-level / contacts).
   *  Visual contract: muted label ABOVE a clear write zone (never ambiguous). */
  drawPrintControl(
    doc: PdfDoc,
    control: QuestionnairePrintControl,
    x: number,
    width: number,
  ): void {
    doc.x = x;
    if (control.kind === 'checkbox_item') {
      const y = doc.y;
      this.drawCheckbox(doc, x, y + 1, control.checked);
      doc
        .fontSize(9)
        .fillColor('#000')
        .text(control.label, x + CHECKBOX_SIZE + 6, y, {
          width: width - CHECKBOX_SIZE - 8,
        });
      doc.y = Math.max(doc.y, y + CHECKBOX_SIZE + FIELD_BOTTOM_GAP);
      doc.x = doc.page.margins.left;
      return;
    }

    if (control.kind === 'choice_list') {
      this.drawFieldLabel(doc, control.label, x, width);
      doc.y += LABEL_TO_WRITE_GAP;
      if (control.layout === 'horizontal') {
        this.drawHorizontalChoiceOptions(doc, control.options, x, width);
      } else {
        for (const opt of control.options) {
          const y = doc.y;
          this.drawCheckbox(doc, x + 4, y + 1, opt.checked);
          doc
            .fontSize(9)
            .fillColor('#000')
            .text(opt.label, x + CHECKBOX_SIZE + 10, y, {
              width: width - CHECKBOX_SIZE - 14,
            });
          doc.y = Math.max(doc.y, y + CHECKBOX_SIZE + 5);
        }
      }
      doc.y += FIELD_BOTTOM_GAP - 4;
      doc.x = doc.page.margins.left;
      return;
    }

    if (control.kind === 'text_box') {
      this.drawFieldLabel(doc, control.label, x, width);
      doc.y += LABEL_TO_WRITE_GAP;
      const boxTop = doc.y;
      const boxH = control.lines * RULED_LINE_HEIGHT + 4;
      this.drawRuledBox(doc, x, boxTop, width, boxH, control.lines);
      if (control.value) {
        doc
          .fontSize(9)
          .fillColor('#000')
          .text(control.value, x + 4, boxTop + 3, {
            width: width - 8,
            height: boxH - 6,
          });
      }
      doc.y = boxTop + boxH + FIELD_BOTTOM_GAP;
      doc.x = doc.page.margins.left;
      return;
    }

    // text_line — label above, dedicated write strip below
    this.drawFieldLabel(doc, control.label, x, width);
    doc.y += LABEL_TO_WRITE_GAP;
    const zoneTop = doc.y;
    this.drawWriteZone(doc, x, zoneTop, width, TEXT_LINE_WRITE_HEIGHT);
    if (control.value) {
      doc
        .fontSize(10)
        .fillColor('#000')
        .text(control.value, x + 4, zoneTop + 4, {
          width: width - 8,
          height: TEXT_LINE_WRITE_HEIGHT - 6,
        });
    }
    doc.y = zoneTop + TEXT_LINE_WRITE_HEIGHT + FIELD_BOTTOM_GAP;
    doc.x = doc.page.margins.left;
  }

  private drawFieldLabel(
    doc: PdfDoc,
    label: string,
    x: number,
    width: number,
  ): void {
    doc.fontSize(8).fillColor('#555').text(label, x, doc.y, { width });
    doc.fillColor('#000');
  }

  /** Options in one row: caption above, checkbox below (languages, status, schedule, …). */
  private drawHorizontalChoiceOptions(
    doc: PdfDoc,
    options: Array<{ value: string; label: string; checked: boolean }>,
    x: number,
    width: number,
  ): void {
    const n = Math.max(options.length, 1);
    const colW = width / n;
    const y0 = doc.y;
    for (let i = 0; i < options.length; i++) {
      const opt = options[i]!;
      const ox = x + i * colW;
      doc
        .fontSize(7)
        .fillColor('#333')
        .text(opt.label, ox, y0, {
          width: Math.max(colW - 2, 8),
          align: 'center',
          height: 10,
          lineBreak: false,
        });
      const cbX = ox + Math.max(0, (colW - CHECKBOX_SIZE) / 2);
      this.drawCheckbox(doc, cbX, y0 + 11, opt.checked);
    }
    doc.fillColor('#000');
    doc.y = y0 + 11 + CHECKBOX_SIZE + 4;
  }

  /** Light bordered strip so the write area is obvious under the label. */
  private drawWriteZone(
    doc: PdfDoc,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    doc
      .rect(x, y, width, height)
      .strokeColor('#b0b6bf')
      .lineWidth(0.7)
      .stroke();
    doc.strokeColor('#000').lineWidth(1);
  }

  /** Compact cell draw — omit redundant label when key-aligned in table header. */
  private drawPrintControlCompact(
    doc: PdfDoc,
    control: QuestionnairePrintControl,
    x: number,
    width: number,
  ): void {
    if (control.kind === 'checkbox_item') {
      const y = doc.y;
      this.drawCheckbox(doc, x, y + 1, control.checked);
      doc.y = y + CHECKBOX_SIZE + 4;
      return;
    }
    if (control.kind === 'choice_list') {
      this.drawHorizontalChoiceOptions(doc, control.options, x, width);
      return;
    }
    if (control.kind === 'text_box') {
      const boxTop = doc.y;
      const boxH = control.lines * RULED_LINE_HEIGHT;
      this.drawRuledBox(doc, x, boxTop, width, boxH, control.lines);
      if (control.value) {
        doc
          .fontSize(8)
          .fillColor('#000')
          .text(control.value, x + 2, boxTop + 1, {
            width: width - 4,
            height: boxH - 2,
          });
      }
      doc.y = boxTop + boxH + 2;
      return;
    }
    // text_line cell — compact write strip
    const zoneTop = doc.y;
    const h = Math.min(TEXT_LINE_WRITE_HEIGHT, 18);
    this.drawWriteZone(doc, x, zoneTop, width, h);
    if (control.value) {
      doc.fontSize(8).fillColor('#000').text(control.value, x + 2, zoneTop + 2, {
        width: width - 4,
        height: h - 4,
      });
    }
    doc.y = zoneTop + h + 2;
  }

  private drawCheckbox(
    doc: PdfDoc,
    x: number,
    y: number,
    checked: boolean,
  ): void {
    doc
      .rect(x, y, CHECKBOX_SIZE, CHECKBOX_SIZE)
      .strokeColor('#333')
      .lineWidth(0.7)
      .stroke();
    if (checked) {
      doc
        .moveTo(x + 2, y + CHECKBOX_SIZE / 2)
        .lineTo(x + CHECKBOX_SIZE / 2 - 0.5, y + CHECKBOX_SIZE - 2)
        .lineTo(x + CHECKBOX_SIZE - 2, y + 2)
        .strokeColor('#000')
        .lineWidth(1.2)
        .stroke();
    }
    doc.strokeColor('#000').lineWidth(1);
  }

  private drawUnderline(
    doc: PdfDoc,
    x: number,
    y: number,
    width: number,
  ): void {
    doc
      .moveTo(x, y)
      .lineTo(x + width, y)
      .strokeColor('#999')
      .lineWidth(0.6)
      .stroke();
    doc.strokeColor('#000').lineWidth(1);
  }

  private drawRuledBox(
    doc: PdfDoc,
    x: number,
    y: number,
    width: number,
    height: number,
    lines: number,
  ): void {
    doc
      .rect(x, y, width, height)
      .strokeColor('#b0b6bf')
      .lineWidth(0.7)
      .stroke();
    const gap = height / Math.max(lines, 1);
    for (let i = 1; i < lines; i++) {
      const ly = y + gap * i;
      doc
        .moveTo(x + 1, ly)
        .lineTo(x + width - 1, ly)
        .strokeColor('#d8dce2')
        .lineWidth(0.4)
        .stroke();
    }
    doc.strokeColor('#000').lineWidth(1);
  }

  /**
   * Start a major questionnaire step on a new page (for cutting printed packs).
   * Does not add a page when the cursor is already on a fresh page — avoids blanks.
   */
  private beginMajorSection(doc: PdfDoc, isFirst: boolean): void {
    if (isFirst) return;
    const top = doc.page.margins.top;
    if (doc.y > top + FRESH_PAGE_Y_SLACK) {
      doc.addPage();
      doc.x = doc.page.margins.left;
      doc.y = doc.page.margins.top;
    }
  }

  private section(doc: PdfDoc, title: string, pageWidth: number): void {
    const needed = 52;
    const bottomLimit = doc.page.height - doc.page.margins.bottom - 36;
    if (
      doc.y + needed > bottomLimit &&
      doc.y > doc.page.margins.top + FRESH_PAGE_Y_SLACK
    ) {
      doc.addPage();
      doc.x = doc.page.margins.left;
      doc.y = doc.page.margins.top;
    }
    const left = doc.page.margins.left;
    doc.x = left;
    const lineY = doc.y + 4;
    doc
      .moveTo(left, lineY)
      .lineTo(left + pageWidth, lineY)
      .lineWidth(1.1)
      .strokeColor('#5c6570')
      .stroke();
    doc.strokeColor('#000').lineWidth(1);
    doc.y = lineY + 10;
    doc.fontSize(13).fillColor('#000').text(title, { width: pageWidth });
    doc.moveDown(0.55);
  }

  private line(
    doc: PdfDoc,
    label: string,
    value: string | null | undefined,
  ): void {
    if (!value) {
      return;
    }
    this.ensureSpace(doc, 16);
    doc.fontSize(10).text(`${label}: ${value}`);
  }

  private ensureSpace(doc: PdfDoc, needed: number): void {
    const bottomLimit = doc.page.height - doc.page.margins.bottom - 36;
    if (doc.y + needed <= bottomLimit) {
      return;
    }
    const top = doc.page.margins.top;
    if (doc.y > top + FRESH_PAGE_Y_SLACK) {
      doc.addPage();
      doc.x = doc.page.margins.left;
      doc.y = doc.page.margins.top;
    }
  }
}
