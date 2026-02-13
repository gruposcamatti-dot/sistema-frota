import React from 'react';

export default function FilterGroup({ val, setVal, options }) {
  return (
    <div className="flex flex-col px-4">
      <select className="bg-transparent text-sm font-bold text-slate-600 outline-none cursor-pointer" value={val} onChange={e => setVal(e.target.value)}>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}
