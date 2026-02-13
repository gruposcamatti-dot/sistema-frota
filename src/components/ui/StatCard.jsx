import React from 'react';

export default function StatCard({ title, val, icon, trend, color }) {
  const themes = { 
    teal: "from-teal-50 text-teal-600 border-teal-100 shadow-teal-100/50", 
    rose: "from-rose-50 text-rose-600 border-rose-100 shadow-rose-100/50", 
    emerald: "from-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-100/50" 
  };
  return (
    <div className={`bg-gradient-to-br ${themes[color] || themes.teal} to-white p-8 rounded-[32px] border shadow-lg hover:scale-[1.02] transition-all`}>
      <div className="flex justify-between items-start mb-6"><div className="p-3 bg-white rounded-2xl shadow-sm">{icon}</div><span className="text-[10px] font-black bg-white px-3 py-1 rounded-full border border-slate-100">{trend}</span></div>
      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">{title}</h4>
      <p className="text-2xl font-black text-slate-900 tracking-tighter">{val}</p>
    </div>
  );
}
