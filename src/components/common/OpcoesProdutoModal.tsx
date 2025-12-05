// src/components/common/OpcoesProdutoModal.tsx
import React, { useState, useEffect } from 'react';
import { GrupoOpcoes, OpcaoItem } from '../../types/cardapio'; 
import { FiX } from 'react-icons/fi';

interface OpcoesProdutoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selecionadas: OpcaoItem[], observacao: string) => void;
  grupo: GrupoOpcoes;
  nomeProduto: string;
}

const OpcoesProdutoModal: React.FC<OpcoesProdutoModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  grupo,
  nomeProduto,
}) => {
  const [opcoesSelecionadas, setOpcoesSelecionadas] = useState<OpcaoItem[]>([]);
  const [observacaoAdicional, setObservacaoAdicional] = useState('');

  useEffect(() => {
    if (isOpen) {
      setOpcoesSelecionadas([]);
      setObservacaoAdicional('');
    }
  }, [isOpen]);

  const handleToggleSelecao = (opcao: OpcaoItem) => {
    if (grupo.tipo_selecao === 'unica') {
      setOpcoesSelecionadas([opcao]);
    } else {
      setOpcoesSelecionadas(prev =>
        prev.find(s => s.id === opcao.id)
          ? prev.filter(s => s.id !== opcao.id)
          : [...prev, opcao]
      );
    }
  };

  const handleConfirmarClick = () => {
    onConfirm(opcoesSelecionadas, observacaoAdicional);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{nomeProduto}</h2>
            <h3 className="text-base text-gray-600">{grupo.nome_grupo}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-800">
            <FiX size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          <div className="space-y-2">
            {grupo.opcoes.map(opcao => {
              // [CORREÇÃO]: Garantimos que o valor é um número antes de verificar e formatar
              const valorNumerico = Number(opcao.valor_adicional || 0);

              return (
                <label key={opcao.id} className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type={grupo.tipo_selecao === 'unica' ? 'radio' : 'checkbox'}
                    name={`opcao-grupo-${grupo.id}`}
                    className="h-5 w-5 rounded-full text-blue-600 border-gray-300 focus:ring-blue-500"
                    checked={opcoesSelecionadas.some(s => s.id === opcao.id)}
                    onChange={() => handleToggleSelecao(opcao)}
                  />
                  <span className="ml-3 flex-grow text-gray-800">{opcao.nome}</span>
                  
                  {/* Exibe o valor apenas se for maior que zero, formatado corretamente */}
                  {valorNumerico > 0 && (
                      <span className="text-sm font-semibold text-green-600">
                          + R$ {valorNumerico.toFixed(2).replace('.', ',')}
                      </span>
                  )}
                </label>
              );
            })}
          </div>

          <textarea
            value={observacaoAdicional}
            onChange={(e) => setObservacaoAdicional(e.target.value)}
            placeholder="Observação adicional (ex: sem gelo, bem passado)..."
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
            rows={2}
          />
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3">
          <button type="button" onClick={onClose} className="px-5 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmarClick}
            className="px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default OpcoesProdutoModal;