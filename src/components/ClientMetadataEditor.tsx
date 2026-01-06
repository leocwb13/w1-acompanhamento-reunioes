import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { getClientMetadata, upsertClientMetadata } from '../services/exportService';
import { useToast } from '../lib/toast';
import type { Database } from '../lib/database.types';

type ClientMetadata = Database['public']['Tables']['client_metadata']['Row'];

interface ClientMetadataEditorProps {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function ClientMetadataEditor({ clientId, clientName, onClose, onSaved }: ClientMetadataEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState<Partial<ClientMetadata>>({
    document_number: '',
    birth_date: null,
    address_street: '',
    address_city: '',
    address_state: '',
    address_zip: '',
    monthly_income: null,
    estimated_patrimony: null,
    financial_goals: '',
    contact_preference: '',
    best_contact_time: '',
    tags: [],
    notes: '',
  });
  const [tagInput, setTagInput] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    loadMetadata();
  }, [clientId]);

  const loadMetadata = async () => {
    setLoading(true);
    try {
      const data = await getClientMetadata(clientId);
      if (data) {
        setMetadata(data);
      }
    } catch (error) {
      console.error('Error loading metadata:', error);
      showToast('Erro ao carregar metadados', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertClientMetadata(clientId, metadata);
      showToast('Metadados salvos com sucesso', 'success');
      if (onSaved) onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving metadata:', error);
      showToast('Erro ao salvar metadados', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !metadata.tags?.includes(tagInput.trim())) {
      setMetadata({
        ...metadata,
        tags: [...(metadata.tags || []), tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setMetadata({
      ...metadata,
      tags: (metadata.tags || []).filter(t => t !== tag),
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Dados Completos - {clientName}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CPF/CNPJ
              </label>
              <input
                type="text"
                value={metadata.document_number || ''}
                onChange={(e) => setMetadata({ ...metadata, document_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de Nascimento
              </label>
              <input
                type="date"
                value={metadata.birth_date || ''}
                onChange={(e) => setMetadata({ ...metadata, birth_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Endereço
            </label>
            <input
              type="text"
              value={metadata.address_street || ''}
              onChange={(e) => setMetadata({ ...metadata, address_street: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Rua, número, complemento"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={metadata.address_city || ''}
                onChange={(e) => setMetadata({ ...metadata, address_city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Cidade"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <input
                type="text"
                value={metadata.address_state || ''}
                onChange={(e) => setMetadata({ ...metadata, address_state: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="UF"
                maxLength={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CEP
              </label>
              <input
                type="text"
                value={metadata.address_zip || ''}
                onChange={(e) => setMetadata({ ...metadata, address_zip: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="00000-000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Renda Mensal (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={metadata.monthly_income || ''}
                onChange={(e) => setMetadata({ ...metadata, monthly_income: parseFloat(e.target.value) || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patrimônio Estimado (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={metadata.estimated_patrimony || ''}
                onChange={(e) => setMetadata({ ...metadata, estimated_patrimony: parseFloat(e.target.value) || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0,00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Objetivos Financeiros
            </label>
            <textarea
              value={metadata.financial_goals || ''}
              onChange={(e) => setMetadata({ ...metadata, financial_goals: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Descreva os principais objetivos financeiros do cliente"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferência de Contato
              </label>
              <select
                value={metadata.contact_preference || ''}
                onChange={(e) => setMetadata({ ...metadata, contact_preference: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecione</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="telefone">Telefone</option>
                <option value="presencial">Presencial</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Melhor Horário para Contato
              </label>
              <input
                type="text"
                value={metadata.best_contact_time || ''}
                onChange={(e) => setMetadata({ ...metadata, best_contact_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Manhã, 14h-18h"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Adicionar tag"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Adicionar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(metadata.tags || []).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              value={metadata.notes || ''}
              onChange={(e) => setMetadata({ ...metadata, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              placeholder="Informações adicionais sobre o cliente"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
