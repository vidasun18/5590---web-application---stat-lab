import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
export function csv(rows) {
  return '\uFEFF' + rows.map(row => row.map(value => {
    let text = value == null ? '' : value instanceof Date ? value.toISOString() : typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}
export function reportCsv(analysis) {
  const c = analysis.calculation;
  return csv([['StatLab MERN', analysis.name], ['Dataset', analysis.snapshot.name], ['Revision', analysis.dataset_revision], ['Calculated', analysis.created_at], [], ['Statistic', 'Value', 'Formula', 'Note'], ...Object.entries(c.results).map(([key, value]) => [c.catalog[key].name, value, c.catalog[key].formula, c.issues[key] || '']), [], ['Custom parameter', 'Value', 'Unit', 'Formula', 'Description'], ...analysis.parameters.map(p => [p.name, p.value, p.unit, p.formula, p.description]), [], ['Method', 'Convention'], ...Object.entries(c.conventions)]);
}
function pdfValue(value) {
  if (typeof value === 'number') return String(Number(value.toPrecision(8)));
  if (Array.isArray(value)) return '[' + value.slice(0, 30).map(pdfValue).join(', ') + ']' + (value.length > 30 ? ` (${value.length} entries; full detail in CSV)` : '');
  if (value && typeof value === 'object') return Object.entries(value).map(([key, v]) => `${key}: ${pdfValue(v)}`).join('; ');
  return String(value ?? 'Undefined');
}
export function reportPdf(response, analysis, username) {
  const doc = new PDFDocument({ size: 'A4', margin: 45, bufferPages: true });
  doc.registerFont('Workspace', fileURLToPath(new URL('./fonts/Vera.ttf', import.meta.url)));
  doc.registerFont('Workspace-Bold', fileURLToPath(new URL('./fonts/VeraBd.ttf', import.meta.url)));
  doc.font('Workspace');
  response.type('pdf'); response.attachment('statlab-analysis.pdf'); doc.pipe(response);
  doc.fontSize(24).fillColor('#17243b').text('StatLab | Analysis report');
  doc.moveDown(.5).fontSize(16).text(analysis.name);
  doc.fontSize(10).fillColor('#5b6c83').text(`${analysis.snapshot.name} | Revision ${analysis.dataset_revision} | ${username}`);
  doc.text(`Saved ${new Date(analysis.created_at).toLocaleString('en-GB')}`);
  doc.text(`${analysis.calculation.summary.count} observations | ${analysis.calculation.summary.column}${analysis.calculation.summary.estimated ? ' | CLASS MIDPOINT ESTIMATES' : ''}`);
  doc.moveDown();
  const values = analysis.calculation.chart_data.values, bins = Math.min(16, Math.max(3, Math.ceil(Math.sqrt(values.length)))), min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const counts = Array(bins).fill(0); values.forEach(v => counts[Math.min(bins - 1, Math.floor((v - min) / span * bins))]++);
  const start = doc.y + 16, height = 95, width = 490 / bins, peak = Math.max(...counts);
  doc.fontSize(10).text('Distribution of observations');
  counts.forEach((count, i) => { const h = count / peak * height; doc.rect(48 + i * width, start + height - h, width - 3, h).fill('#5276e5'); });
  doc.fillColor('#5b6c83').fontSize(8).text(String(min), 48, start + height + 5).text(String(max), 470, start + height + 5, { width: 65, align: 'right' });
  doc.y = start + height + 35; doc.x = 45;
  const line = (label, value) => { if (doc.y > 710) doc.addPage(); doc.font('Workspace-Bold').fillColor('#17243b').fontSize(10).text(label, 45, doc.y); doc.font('Workspace').fillColor('#5b6c83').fontSize(9).text(String(value).slice(0, 1800), { width: 500 }); doc.moveDown(.55); };
  for (const [key, value] of Object.entries(analysis.calculation.results)) line(analysis.calculation.catalog[key].name, value === null ? analysis.calculation.issues[key] : pdfValue(value));
  const section = (title, requiredSpace) => { if (doc.y + requiredSpace > 730) doc.addPage(); else doc.moveDown(1); doc.font('Workspace-Bold').fontSize(16).fillColor('#17243b').text(title, 45, doc.y); doc.font('Workspace'); doc.moveDown(.65); };
  if (analysis.parameters.length) { section('Custom parameters', 150); for (const p of analysis.parameters) line(p.name, `${p.value} ${p.unit}\n${p.formula}\n${p.description}`); }
  section('Methodology and reproducibility', 330);
  for (const [key, value] of Object.entries(analysis.calculation.conventions)) line(key, value);
  line('Calculation engine', analysis.calculation.algorithm_version); line('Settings', JSON.stringify(analysis.calculation.settings || {})); line('Source snapshot', 'This report uses the immutable dataset snapshot stored with the analysis. Custom parameters reflect their current saved values. Full arrays and frequency tables are included in the CSV export.');
  const pages = doc.bufferedPageRange(); for (let p = 0; p < pages.count; p++) { doc.switchToPage(p); doc.fontSize(8).fillColor('#738095').text(`StatLab MERN | ${p + 1} / ${pages.count}`, 45, 790, { lineBreak: false }); }
  doc.end();
}
