import React from 'react';
import { FileText } from 'lucide-react';

export default function FechamentoView() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh] animate-in fade-in zoom-in duration-500">
      <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mb-6 shadow-sm">
        <FileText size={48} className="text-teal-600" />
      </div>
      <h2 className="text-3xl font-bold text-slate-800 mb-2">Fechamento</h2>
      <p className="text-slate-500 max-w-md text-lg">
        Painel de fechamento mensal em desenvolvimento.
      </p>
    </div>
  );
}
