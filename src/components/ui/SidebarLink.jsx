import React from 'react';

export default function SidebarLink({ icon, label, active, onClick, collapsed }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${active ? 'bg-teal-600 text-white shadow-xl shadow-teal-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-white'}`}>
      <span className={`${active ? 'text-white' : 'group-hover:text-teal-400'} shrink-0`}>{icon}</span>
      {!collapsed && <span className="font-bold text-sm tracking-tight whitespace-nowrap animate-in fade-in duration-300">{label}</span>}
    </button>
  );
}
