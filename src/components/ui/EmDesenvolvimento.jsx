import React from 'react';
import { Wrench } from 'lucide-react';

export default function EmDesenvolvimento({ titulo }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh] animate-in fade-in zoom-in duration-500">
      <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
        <Wrench size={48} className="text-slate-400" />
      </div>
      <h2 className="text-3xl font-bold text-slate-800 mb-2">{titulo}</h2>
      <p className="text-slate-500 max-w-md text-lg">
        Este módulo está sendo atualizado e estará disponível em breve com novas funcionalidades.
      </p>
    </div>
  );
}
