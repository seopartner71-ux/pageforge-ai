import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { Row } from './engine';

/** Читает .xlsx/.xls/.csv локально (без отправки на сервер) в массив строк-объектов. */
export function readTable(name: string, buf: ArrayBuffer): Row[] {
  const lower = name.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    let text = new TextDecoder('utf-8').decode(buf);
    // cp1251-фолбэк: если в тексте много «�»
    if ((text.match(/\uFFFD/g)?.length ?? 0) > 5) text = new TextDecoder('windows-1251').decode(buf);
    text = text.replace(/^\uFEFF/, '');
    const res = Papa.parse<Row>(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
    return res.data;
  }
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: null, raw: true });
}
