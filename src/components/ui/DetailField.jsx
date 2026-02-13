import React from 'react';

export default function DetailField({ label, val, isTotal }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
      <div className={`text-base font-bold ${isTotal ? 'text-teal-600 text-lg' : 'text-slate-800'}`}>{val || '—'}</div>
    </div>
  );
}
