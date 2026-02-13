import React from 'react';

export default function FormField({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full p-4 bg-slate-50 border-0 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-teal-500 outline-none transition" placeholder={placeholder} />
    </div>
  );
}
