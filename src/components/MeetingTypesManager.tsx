import { useState, useEffect } from 'react';
import { Plus, Edit2, Power, PowerOff, Save, X, Calendar } from 'lucide-react';
import * as Icons from 'lucide-react';
import {
  getAllMeetingTypes,
  createMeetingType,
  updateMeetingType,
  toggleMeetingTypeStatus,
  countCustomMeetingTypes,
  type MeetingTypeDetails,
  type CreateMeetingTypeInput,
  type UpdateMeetingTypeInput
} from '../services/meetingTypeService';
import { useToast } from '../lib/toast';

const AVAILABLE_COLORS = [
  { name: 'Azul', value: '#3B82F6' },
  { name: 'Verde', value: '#10B981' },
  { name: 'Amarelo', value: '#F59E0B' },
  { name: 'Roxo', value: '#8B5CF6' },
  { name: 'Rosa', value: '#EC4899' },
  { name: 'Vermelho', value: '#EF4444' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Laranja', value: '#F97316' },
  { name: 'Cinza', value: '#6B7280' }
];

const AVAILABLE_ICONS = [
  'Calendar', 'Search', 'Shield', 'TrendingUp', 'CheckCircle', 'RefreshCw',
  'Target', 'Users', 'Briefcase', 'FileText', 'MessageSquare', 'Phone',
  'Video', 'Clock', 'Award', 'Star', 'Heart', 'Zap'
];

export default function MeetingTypesManager() {
  const [systemTypes, setSystemTypes] = useState<MeetingTypeDetails[]>([]);
  const [customTypes, setCustomTypes] = useState<MeetingTypeDetails[]>([]);
  const [customCount, setCustomCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const [formData, setFormData] = useState<CreateMeetingTypeInput>({
    code: '',
    display_name: '',
    description: '',
    color: '#3B82F6',
    icon: 'Calendar'
  });

  const [editData, setEditData] = useState<UpdateMeetingTypeInput>({});

  useEffect(() => {
    loadMeetingTypes();
  }, []);

  const loadMeetingTypes = async () => {
    try {
      setLoading(true);
      const [types, count] = await Promise.all([
        getAllMeetingTypes(),
        countCustomMeetingTypes()
      ]);

      setSystemTypes(types.filter(t => t.is_system));
      setCustomTypes(types.filter(t => !t.is_system));
      setCustomCount(count);
    } catch (error: any) {
      console.error('Error loading meeting types:', error);
      showToast(error.message || 'Erro ao carregar tipos de reunião', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code || !formData.display_name) {
      showToast('Preencha código e nome', 'error');
      return;
    }

    try {
      await createMeetingType(formData);
      showToast('Tipo criado com sucesso', 'success');
      setShowAddForm(false);
      setFormData({
        code: '',
        display_name: '',
        description: '',
        color: '#3B82F6',
        icon: 'Calendar'
      });
      await loadMeetingTypes();
    } catch (error: any) {
      console.error('Error creating type:', error);
      showToast(error.message || 'Erro ao criar tipo', 'error');
    }
  };

  const handleUpdateType = async (id: string) => {
    try {
      await updateMeetingType(id, editData);
      showToast('Tipo atualizado com sucesso', 'success');
      setEditingId(null);
      setEditData({});
      await loadMeetingTypes();
    } catch (error: any) {
      console.error('Error updating type:', error);
      showToast(error.message || 'Erro ao atualizar tipo', 'error');
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      await toggleMeetingTypeStatus(id);
      showToast('Status alterado com sucesso', 'success');
      await loadMeetingTypes();
    } catch (error: any) {
      console.error('Error toggling status:', error);
      showToast(error.message || 'Erro ao alterar status', 'error');
    }
  };

  const startEditing = (type: MeetingTypeDetails) => {
    setEditingId(type.id);
    setEditData({
      display_name: type.display_name,
      description: type.description,
      color: type.color,
      icon: type.icon
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData({});
  };

  const renderIcon = (iconName: string, className: string = 'w-5 h-5') => {
    const IconComponent = (Icons as any)[iconName] || Calendar;
    return <IconComponent className={className} />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando tipos de reunião...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Tipos de Reunião</h2>
          <p className="text-sm text-gray-600 mt-1">
            {customCount}/10 tipos customizados criados
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={customCount >= 10}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Adicionar Tipo
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Novo Tipo de Reunião</h3>
            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleCreateType} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="EX: DIAG"
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">2-10 caracteres, maiúsculas</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome de Exibição *
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="Ex: Diagnóstico"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional do tipo de reunião"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cor
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {AVAILABLE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        formData.color === color.value ? 'border-gray-900 scale-110' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ícone
                </label>
                <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto">
                  {AVAILABLE_ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon })}
                      className={`p-2 rounded-lg border transition-all ${
                        formData.icon === icon ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {renderIcon(icon, 'w-5 h-5')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs text-gray-600 mb-2">Preview:</p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: formData.color + '20', borderColor: formData.color, borderWidth: 1 }}>
                {renderIcon(formData.icon, 'w-4 h-4')}
                <span className="text-sm font-medium" style={{ color: formData.color }}>
                  {formData.display_name || 'Nome do Tipo'}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Criar Tipo
              </button>
            </div>
          </form>
        </div>
      )}

      <div>
        <h3 className="font-medium text-gray-900 mb-3">Tipos do Sistema</h3>
        <div className="space-y-2">
          {systemTypes.map((type) => (
            <div
              key={type.id}
              className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: type.color + '20' }}>
                  {renderIcon(type.icon, 'w-5 h-5')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{type.code}</span>
                    <span className="text-gray-600">-</span>
                    <span className="text-gray-900">{type.display_name}</span>
                  </div>
                  <p className="text-sm text-gray-600">{type.description}</p>
                </div>
              </div>
              <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded">Sistema</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-medium text-gray-900 mb-3">Tipos Customizados</h3>
        {customTypes.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600">Nenhum tipo customizado criado ainda</p>
            <p className="text-sm text-gray-500 mt-1">Você pode criar até 10 tipos customizados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {customTypes.map((type) => (
              <div
                key={type.id}
                className={`bg-white border rounded-lg p-4 ${
                  type.is_active ? 'border-gray-200' : 'border-gray-300 bg-gray-50 opacity-60'
                }`}
              >
                {editingId === type.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nome de Exibição
                        </label>
                        <input
                          type="text"
                          value={editData.display_name || ''}
                          onChange={(e) => setEditData({ ...editData, display_name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Descrição
                        </label>
                        <input
                          type="text"
                          value={editData.description || ''}
                          onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
                        <div className="grid grid-cols-5 gap-2">
                          {AVAILABLE_COLORS.map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              onClick={() => setEditData({ ...editData, color: color.value })}
                              className={`w-10 h-10 rounded-lg border-2 transition-all ${
                                editData.color === color.value ? 'border-gray-900 scale-110' : 'border-gray-300'
                              }`}
                              style={{ backgroundColor: color.value }}
                              title={color.name}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ícone</label>
                        <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto">
                          {AVAILABLE_ICONS.map((icon) => (
                            <button
                              key={icon}
                              type="button"
                              onClick={() => setEditData({ ...editData, icon })}
                              className={`p-2 rounded-lg border transition-all ${
                                editData.icon === icon ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                              }`}
                            >
                              {renderIcon(icon, 'w-5 h-5')}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateType(type.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        Salvar
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: type.color + '20' }}>
                        {renderIcon(type.icon, 'w-5 h-5')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{type.code}</span>
                          <span className="text-gray-600">-</span>
                          <span className="text-gray-900">{type.display_name}</span>
                          {!type.is_active && (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">Inativo</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{type.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEditing(type)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(type.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          type.is_active
                            ? 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                            : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={type.is_active ? 'Desativar' : 'Ativar'}
                      >
                        {type.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
