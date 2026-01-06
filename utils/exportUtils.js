import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate Excel file from data
 * @param {Array} data - Array of objects to export
 * @param {Array} headers - Column headers
 * @param {String} filename - Output filename
 * @param {Object} options - Additional options (sheetName, title, etc.)
 * @returns {Promise<Buffer>}
 */
export const generateExcel = async (data, headers, filename, options = {}) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(options.sheetName || 'Sheet1');

    // Add title row if provided
    if (options.title) {
        worksheet.mergeCells('A1:' + String.fromCharCode(64 + headers.length) + '1');
        const titleRow = worksheet.getRow(1);
        titleRow.getCell(1).value = options.title;
        titleRow.getCell(1).font = { size: 16, bold: true };
        titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        titleRow.height = 25;
    }

    // Add headers
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 20;

    // Add data rows
    data.forEach((row) => {
        const values = headers.map((header) => {
            const key = header.key || header;
            return row[key] !== undefined ? row[key] : '';
        });
        worksheet.addRow(values);
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
        column.width = 15;
    });

    // Style all cells
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > (options.title ? 2 : 1)) {
            row.eachCell((cell) => {
                cell.alignment = { horizontal: 'left', vertical: 'middle' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
};

/**
 * Generate PDF from data
 * @param {Array} data - Array of objects to export
 * @param {Array} headers - Column headers
 * @param {String} title - PDF title
 * @param {Object} options - Additional options
 * @returns {Promise<Buffer>}
 */
export const generatePDF = (data, headers, title, options = {}) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: options.size || 'A4',
                margin: 50,
                layout: options.landscape ? 'landscape' : 'portrait'
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);

            // Add title
            doc.fontSize(20).text(title, { align: 'center' });
            doc.moveDown();

            // Add date filter if provided
            if (options.dateFilter) {
                doc.fontSize(10).text(options.dateFilter, { align: 'center' });
                doc.moveDown();
            }

            // Calculate column widths
            const pageWidth = options.landscape ? 792 : 612;
            const margin = 50;
            const availableWidth = pageWidth - (margin * 2);
            const columnCount = headers.length;
            const columnWidth = availableWidth / columnCount;

            // Add table header
            let x = margin;
            let y = doc.y;
            const rowHeight = 25;

            // Header background
            doc.rect(x, y, availableWidth, rowHeight).fill('#4472C4');

            // Header text
            headers.forEach((header, index) => {
                const headerText = header.label || header;
                doc.fontSize(10)
                    .fillColor('white')
                    .text(headerText, x + 5, y + 5, {
                        width: columnWidth - 10,
                        align: 'left'
                    });
                x += columnWidth;
            });

            y += rowHeight;

            // Add data rows
            data.forEach((row, rowIndex) => {
                if (y + rowHeight > (options.landscape ? 612 : 792) - margin) {
                    doc.addPage();
                    y = margin;
                }

                x = margin;
                const fillColor = rowIndex % 2 === 0 ? '#F2F2F2' : 'white';
                doc.rect(x, y, availableWidth, rowHeight).fill(fillColor);

                headers.forEach((header, colIndex) => {
                    const key = header.key || header;
                    const value = row[key] !== undefined ? String(row[key]) : '';
                    doc.fontSize(9)
                        .fillColor('black')
                        .text(value, x + 5, y + 5, {
                            width: columnWidth - 10,
                            align: 'left'
                        });
                    x += columnWidth;
                });

                y += rowHeight;
            });

            // Add footer
            doc.fontSize(8)
                .fillColor('gray')
                .text(
                    `Generated on ${new Date().toLocaleString()}`,
                    margin,
                    doc.page.height - 30,
                    { align: 'center', width: availableWidth }
                );

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

/**
 * Generate CSV from data
 * @param {Array} data - Array of objects to export
 * @param {Array} headers - Column headers
 * @returns {String}
 */
export const generateCSV = (data, headers) => {
    const headerRow = headers.map(h => h.label || h).join(',');
    const rows = data.map(row => {
        return headers.map(header => {
            const key = header.key || header;
            const value = row[key] !== undefined ? String(row[key]) : '';
            // Escape commas and quotes
            return `"${value.replace(/"/g, '""')}"`;
        }).join(',');
    });

    return [headerRow, ...rows].join('\n');
};

/**
 * Format currency
 */
export const formatCurrency = (amount, currencyCode = 'USD', position = 'left') => {
    const symbols = {
        USD: '$',
        EUR: '€',
        GBP: '£',
        SAR: 'ر.س',
        AED: 'د.إ'
    };
    const symbol = symbols[currencyCode] || currencyCode;
    const formatted = parseFloat(amount || 0).toFixed(2);
    
    return position === 'left' ? `${symbol}${formatted}` : `${formatted}${symbol}`;
};

/**
 * Format date
 */
export const formatDate = (date, format = 'YYYY-MM-DD') => {
    if (!date) return '-';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
};

